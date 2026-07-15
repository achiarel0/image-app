import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  isEntitled,
  revalidateSubscription,
  subscriptionIdOf,
} from "@/lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The proxy sends users with a lapsed paid_until claim here (when they have
// a known subscription): ask Stripe whether the subscription is actually
// still active. Renewed → extend paid_until and bounce through /payment/
// refreshed to mint a fresh JWT. Ended → the paywall.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isEntitled(data.claims.app_metadata)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const subId = subscriptionIdOf(data.claims.app_metadata);
  const active = subId
    ? await revalidateSubscription(data.claims.sub, subId)
    : false;

  return NextResponse.redirect(
    new URL(active ? "/payment/refreshed" : "/pay?state=expired", request.url),
  );
}
