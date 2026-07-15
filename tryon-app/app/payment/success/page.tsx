import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCheckoutSession } from "@/lib/stripe";
import { activateFromSession } from "@/lib/payments";
import { AuthShell, submitClass } from "../../components/AuthShell";
import { SessionRefresher } from "./SessionRefresher";

export const dynamic = "force-dynamic";

// Stripe redirects here after checkout with ?session_id={CHECKOUT_SESSION_ID}.
// Everything is verified server-side against Stripe with the secret key — a
// forged session_id 404s and an unpaid session fails payment_status — so a
// tampered URL grants nothing. Activation is idempotent (safe to reload).
// This page is public: the payer's cookie session may have lapsed, but the
// checkout session's client_reference_id identifies the user regardless.
export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;

  const session = session_id ? await getCheckoutSession(session_id) : null;
  const activated =
    session && session.payment_status === "paid"
      ? await activateFromSession(session)
      : false;

  if (!activated) {
    return (
      <AuthShell
        eyebrow="Payment"
        title="We couldn't confirm that payment"
        subtitle="The checkout link is invalid or the payment hasn't completed."
      >
        <Link href="/pay" className={`${submitClass} w-full`}>
          Back to subscription
        </Link>
      </AuthShell>
    );
  }

  // If the payer is signed in here, refresh the JWT client-side so it picks
  // up the new paid_until claim, then continue into the app.
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const signedIn = !!data?.claims;

  return (
    <AuthShell
      eyebrow="Payment confirmed"
      title="Subscription active"
      subtitle="Thank you! Your membership is ready."
    >
      {signedIn ? (
        <SessionRefresher />
      ) : (
        <Link href="/login" className={`${submitClass} w-full`}>
          Log in to start
        </Link>
      )}
    </AuthShell>
  );
}
