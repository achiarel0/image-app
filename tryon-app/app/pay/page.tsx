import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthShell, submitClass } from "../components/AuthShell";
import { isEntitled } from "@/lib/payments";

export const dynamic = "force-dynamic";

// Paywall: signed-in users without an active subscription land here (the
// proxy redirects them). The Stripe Payment Link is composed server-side so
// the URL env var never enters the client bundle; client_reference_id ties
// the checkout session back to this Supabase user.
export default async function PayPage({
  searchParams,
}: {
  searchParams: Promise<{ recheck?: string; state?: string }>;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");
  if (isEntitled(data.claims.app_metadata)) redirect("/");

  const { recheck, state } = await searchParams;

  const email = typeof data.claims.email === "string" ? data.claims.email : "";
  const payUrl =
    `${process.env.STRIPE_PAYMENT_LINK_URL}` +
    `?client_reference_id=${encodeURIComponent(data.claims.sub)}` +
    `&prefilled_email=${encodeURIComponent(email)}`;

  return (
    <AuthShell
      eyebrow="Membership"
      title="Subscribe to Atelier"
      subtitle="Unlimited AI try-on generations while your subscription is active."
    >
      <div className="space-y-6">
        {state === "expired" && (
          <p className="rounded-md border border-neutral-300 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
            Your subscription has ended. Resubscribe to continue generating.
          </p>
        )}
        {recheck === "notfound" && (
          <p className="rounded-md border border-neutral-300 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
            We couldn&apos;t find a completed payment yet — it can take a few
            seconds after checkout. Try again shortly.
          </p>
        )}

        <div className="border border-neutral-200 p-6">
          <p className="text-3xl font-semibold">
            $9.99
            <span className="ml-2 text-sm font-normal uppercase tracking-[0.2em] text-neutral-400">
              / month
            </span>
          </p>
          <p className="mt-2 text-sm text-neutral-500">
            Cancel anytime. Access ends when your billing period does.
          </p>
        </div>

        <a href={payUrl} className={`${submitClass} w-full`}>
          Subscribe with Stripe
        </a>

        <p className="text-center text-sm text-neutral-500">
          <a
            href="/payment/recheck"
            className="underline underline-offset-4 hover:text-neutral-900"
          >
            Already subscribed? Check again
          </a>
        </p>
      </div>
    </AuthShell>
  );
}
