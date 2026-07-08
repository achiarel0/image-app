import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client for client components. createBrowserClient
// is a singleton internally, so calling this per-component is fine.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
