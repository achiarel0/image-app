import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Paths reachable without a session. Everything else redirects to /login.
// /payment is public so a payer whose session lapsed still lands on the
// success page (activation is keyed by the Stripe session, not the cookie).
const PUBLIC_PATHS = ["/login", "/signup", "/payment"];

// Paths a signed-in user may reach without an active subscription.
const UNPAID_ALLOWED = ["/pay", ...PUBLIC_PATHS];

// Clock-skew allowance only; must match ACTIVE_GRACE_MS in lib/payments.ts.
// (Not imported: that module pulls in the service-role admin client, which
// has no place in the proxy bundle.)
const ACTIVE_GRACE_MS = 60_000;

function matchesAny(pathname: string, paths: string[]): boolean {
  return paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// Refreshes the Supabase auth token on every matched request, keeps the
// request + response cookies in sync, and redirects logged-out visitors to
// /login (the app requires an account).
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and getClaims(): it validates
  // the JWT and triggers the token refresh that setAll above writes back.
  // getClaims() (not getSession()) is what makes this check trustworthy —
  // it verifies the JWT signature instead of trusting the cookie.
  const { data } = await supabase.auth.getClaims();

  const { pathname } = request.nextUrl;
  const isPublic = matchesAny(pathname, PUBLIC_PATHS);

  if (!data?.claims && !isPublic) {
    // API routes get a 401 (a redirect makes no sense for fetch calls);
    // the /api/generate handler also re-checks auth itself.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Please log in." }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Subscription gate: paid_until in app_metadata mirrors the Stripe
  // subscription period. This check is claims-only (no DB, no Stripe — the
  // proxy runs on every request). /api/generate re-checks authoritatively
  // and revalidates lapsed subscriptions against Stripe.
  if (data?.claims && !matchesAny(pathname, UNPAID_ALLOWED)) {
    const meta = data.claims.app_metadata as
      | { paid_until?: string; stripe_subscription_id?: string }
      | undefined;
    const paidUntil = meta?.paid_until ? Date.parse(meta.paid_until) : NaN;
    const entitled =
      Number.isFinite(paidUntil) && paidUntil + ACTIVE_GRACE_MS > Date.now();

    if (!entitled) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "Payment required." },
          { status: 402 },
        );
      }
      const url = request.nextUrl.clone();
      // A lapsed paid_until may just mean the subscription renewed since the
      // JWT was minted — let /payment/revalidate ask Stripe before deciding.
      url.pathname = meta?.stripe_subscription_id
        ? "/payment/revalidate"
        : "/pay";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
