"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuthShell, FieldLabel, inputClass, submitClass } from "../components/AuthShell";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name.trim() } },
    });

    if (error) {
      setErrorMessage(error.message);
      setIsSubmitting(false);
      return;
    }

    // If email confirmation is enabled in Supabase, no session is returned
    // until the user clicks the link in the email.
    if (!data.session) {
      setNeedsConfirmation(true);
      setIsSubmitting(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <AuthShell
      eyebrow="Create Account"
      title="Sign Up"
      subtitle="Create an account with your email and a password."
    >
      {needsConfirmation ? (
        <p className="rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
          Almost there — check your email for a confirmation link, then{" "}
          <Link href="/login" className="underline">
            log in
          </Link>
          .
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <FieldLabel htmlFor="name">Name</FieldLabel>
            <input
              id="name"
              type="text"
              required
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </div>

          {errorMessage && (
            <p
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700"
            >
              {errorMessage}
            </p>
          )}

          <button type="submit" disabled={isSubmitting} className={submitClass}>
            {isSubmitting ? "Creating account..." : "Sign Up"}
          </button>

          <p className="text-center text-sm text-neutral-500">
            Already have an account?{" "}
            <Link href="/login" className="text-neutral-900 underline">
              Log in
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
