import { createClient } from "@supabase/supabase-js";

// Service-role Supabase client. Bypasses RLS and can mutate auth users
// (app_metadata), so it must only ever run on the server — never import
// this module from a client component.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
