"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// The proxy gates on the JWT's paid_until claim, and the token in this
// browser was minted before the purchase. Server code can't rewrite the
// client's cookies from a Server Component, so refresh the session here:
// Supabase issues a fresh access token carrying the new app_metadata.
export function SessionRefresher({ label }: { label?: string }) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.refreshSession();
      if (cancelled) return;
      if (error) {
        setFailed(true);
        return;
      }
      router.push("/");
      router.refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (failed) {
    return (
      <p className="text-sm text-neutral-500">
        Almost there —{" "}
        <a href="/" className="underline underline-offset-4">
          continue to the studio
        </a>
        .
      </p>
    );
  }

  return (
    <p className="text-sm text-neutral-500" role="status">
      {label ?? "Finalizing your access…"}
    </p>
  );
}
