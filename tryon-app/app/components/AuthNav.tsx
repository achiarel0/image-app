"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

// Header auth status: sign in/up links when logged out, the user's name and
// a sign-out button when logged in.
export default function AuthNav() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setIsReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    // The app requires login, so leaving the session means leaving the page.
    router.push("/login");
    router.refresh();
  }

  // Avoid a logged-in/out flash before the first auth check resolves.
  if (!isReady) return <div className="min-w-[120px]" />;

  if (!user) {
    return (
      <nav className="flex items-center gap-4 text-xs font-medium uppercase tracking-[0.15em]">
        <Link href="/login" className="text-neutral-500 transition hover:text-black">
          Log In
        </Link>
        <Link
          href="/signup"
          className="rounded-full border border-black px-4 py-1.5 text-black transition hover:bg-black hover:text-white"
        >
          Sign Up
        </Link>
      </nav>
    );
  }

  const displayName =
    (user.user_metadata?.full_name as string | undefined) || user.email;

  return (
    <nav className="flex items-center gap-4 text-xs uppercase tracking-[0.15em]">
      <span className="max-w-[180px] truncate text-neutral-500" title={displayName}>
        {displayName}
      </span>
      <button
        type="button"
        onClick={signOut}
        className="font-medium text-neutral-500 underline-offset-4 transition hover:text-black hover:underline"
      >
        Sign Out
      </button>
    </nav>
  );
}
