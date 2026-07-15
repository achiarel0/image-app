import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { findPaidSessionForUser } from "@/lib/stripe";
import { isEntitled } from "@/lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Fallback for "I paid, but the redirect back never happened" (closed tab,
// network blip): look for a completed checkout session for this user on our
// payment link and, if found, reuse the success flow — the one activation
// code path. Idempotent, so a GET with side effects is acceptable here.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isEntitled(data.claims.app_metadata)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const session = await findPaidSessionForUser(data.claims.sub);
  return NextResponse.redirect(
    new URL(
      session
        ? `/payment/success?session_id=${encodeURIComponent(session.id)}`
        : "/pay?recheck=notfound",
      request.url,
    ),
  );
}
