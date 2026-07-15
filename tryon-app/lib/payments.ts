import { createAdminClient } from "@/lib/supabase/admin";
import {
  getSubscription,
  subscriptionPeriodEnd,
  type StripeCheckoutSession,
} from "@/lib/stripe";

// Entitlement model: app_metadata carries { stripe_customer_id,
// stripe_subscription_id, paid_until }. paid_until mirrors the Stripe
// subscription's current_period_end; the JWT is a cache with a hard TTL and
// Stripe stays the source of truth. When paid_until lapses, callers
// revalidate against Stripe: an active subscription silently extends it, an
// ended one locks the user out.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Small allowance for clock skew only — a lapsed subscription gets no grace.
const ACTIVE_GRACE_MS = 60_000;

const ACTIVE_STATUSES = ["active", "trialing"];

export function isEntitled(appMetadata: unknown): boolean {
  const paidUntil = (appMetadata as { paid_until?: string } | undefined)
    ?.paid_until;
  if (!paidUntil) return false;
  const ts = Date.parse(paidUntil);
  return Number.isFinite(ts) && ts + ACTIVE_GRACE_MS > Date.now();
}

export function subscriptionIdOf(appMetadata: unknown): string | null {
  const id = (appMetadata as { stripe_subscription_id?: string } | undefined)
    ?.stripe_subscription_id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

// Activate a user's entitlement from a verified checkout session. The caller
// must already have confirmed payment_status === "paid". Idempotent: the
// payments upsert ignores duplicate session ids and re-writing app_metadata
// with the same values is harmless.
export async function activateFromSession(
  session: StripeCheckoutSession,
): Promise<boolean> {
  const userId = session.client_reference_id;
  if (!userId || !UUID_RE.test(userId)) {
    console.error(`Checkout session ${session.id} has no valid user id`);
    return false;
  }
  if (!session.subscription) {
    console.error(`Checkout session ${session.id} has no subscription`);
    return false;
  }

  const sub = await getSubscription(session.subscription);
  const periodEnd = sub ? subscriptionPeriodEnd(sub) : null;
  if (!sub || !ACTIVE_STATUSES.includes(sub.status) || !periodEnd) {
    console.error(
      `Subscription ${session.subscription} not active (status: ${sub?.status})`,
    );
    return false;
  }

  const admin = createAdminClient();

  // GoTrue merges the given app_metadata into the existing object, so the
  // built-in provider/providers keys survive this update.
  const { error: userError } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: {
      stripe_customer_id: session.customer,
      stripe_subscription_id: sub.id,
      paid_until: new Date(periodEnd * 1000).toISOString(),
    },
  });
  if (userError) {
    console.error(`Failed to mark user ${userId} paid:`, userError.message);
    return false;
  }

  const { error: insertError } = await admin.from("payments").upsert(
    {
      user_id: userId,
      stripe_session_id: session.id,
      stripe_subscription_id: sub.id,
      stripe_customer_id: session.customer,
      amount: session.amount_total,
      currency: session.currency,
      email: session.customer_details?.email ?? null,
    },
    { onConflict: "stripe_session_id", ignoreDuplicates: true },
  );
  if (insertError) {
    // The entitlement is already granted; a failed audit row is logged but
    // does not block the user.
    console.error(
      `Failed to record payment ${session.id}:`,
      insertError.message,
    );
  }
  return true;
}

// Re-check a (possibly lapsed) subscription against Stripe. Returns true and
// extends paid_until if it is still active; otherwise clears paid_until so
// every gate agrees the user is out.
export async function revalidateSubscription(
  userId: string,
  subscriptionId: string,
): Promise<boolean> {
  if (!UUID_RE.test(userId)) return false;

  const sub = await getSubscription(subscriptionId);
  const periodEnd = sub ? subscriptionPeriodEnd(sub) : null;
  const active =
    !!sub && ACTIVE_STATUSES.includes(sub.status) && !!periodEnd;

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: {
      paid_until: active ? new Date(periodEnd! * 1000).toISOString() : null,
    },
  });
  if (error) {
    console.error(
      `Failed to update paid_until for ${userId}:`,
      error.message,
    );
    return false;
  }
  return active;
}
