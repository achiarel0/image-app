// Minimal server-only Stripe REST helpers. The app makes a handful of GET
// calls, so a plain fetch wrapper beats pulling in the full stripe SDK.
// All functions return null on any failure and log the real error
// server-side (same policy as the generate route).

export type StripeCheckoutSession = {
  id: string;
  status: string; // "complete" | "open" | "expired"
  payment_status: string; // "paid" | "unpaid" | "no_payment_required"
  client_reference_id: string | null;
  subscription: string | null;
  customer: string | null;
  amount_total: number | null;
  currency: string | null;
  customer_details: { email: string | null } | null;
};

export type StripeSubscription = {
  id: string;
  status: string; // "active" | "trialing" | "past_due" | "canceled" | ...
  customer: string | null;
  // Unix seconds. Older API versions expose this on the subscription;
  // newer ones only on each subscription item.
  current_period_end?: number;
  items?: { data?: { current_period_end?: number }[] };
};

const STRIPE_API = "https://api.stripe.com/v1";

const SESSION_ID_RE = /^cs_(test|live)_[A-Za-z0-9]+$/;
const SUBSCRIPTION_ID_RE = /^sub_[A-Za-z0-9]+$/;

async function stripeGet<T>(path: string): Promise<T | null> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.error("STRIPE_SECRET_KEY is not set");
    return null;
  }
  try {
    const res = await fetch(`${STRIPE_API}${path}`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`Stripe GET ${path} failed: ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.error(`Stripe GET ${path} threw`, err);
    return null;
  }
}

// Retrieve one checkout session by id (the id arrives via the success-page
// URL, so validate its shape before interpolating it into the path).
export async function getCheckoutSession(
  sessionId: string,
): Promise<StripeCheckoutSession | null> {
  if (!SESSION_ID_RE.test(sessionId)) return null;
  return stripeGet<StripeCheckoutSession>(`/checkout/sessions/${sessionId}`);
}

// Retrieve a subscription to check whether it is still active and until when.
export async function getSubscription(
  subscriptionId: string,
): Promise<StripeSubscription | null> {
  if (!SUBSCRIPTION_ID_RE.test(subscriptionId)) return null;
  return stripeGet<StripeSubscription>(`/subscriptions/${subscriptionId}`);
}

// Unix seconds the subscription is paid through, wherever the API version
// put it.
export function subscriptionPeriodEnd(sub: StripeSubscription): number | null {
  return (
    sub.current_period_end ??
    sub.items?.data?.[0]?.current_period_end ??
    null
  );
}

// Fallback for "I paid but the redirect never happened": list completed
// sessions for our payment link and find one for this user. The list API
// cannot filter by client_reference_id, so match in memory (volume is tiny).
export async function findPaidSessionForUser(
  userId: string,
): Promise<StripeCheckoutSession | null> {
  const linkId = process.env.STRIPE_PAYMENT_LINK_ID;
  if (!linkId) {
    console.error("STRIPE_PAYMENT_LINK_ID is not set");
    return null;
  }
  const list = await stripeGet<{ data: StripeCheckoutSession[] }>(
    `/checkout/sessions?payment_link=${encodeURIComponent(linkId)}&status=complete&limit=100`,
  );
  return (
    list?.data?.find(
      (s) => s.client_reference_id === userId && s.payment_status === "paid",
    ) ?? null
  );
}
