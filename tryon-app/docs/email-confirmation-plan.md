# Plan: Require verified email + subscription before access

**Status: NOT implemented — reference for future work.** (Written 2026-07-15.)

Goal: users must (1) register **and confirm their email**, then (2) subscribe
($9.99/month via the Stripe Payment Link), before they can use the app.

The subscription gate (proxy `paid_until` check, `/pay`, `/payment/*`, 402 in
`/api/generate`) is already live and needs **zero changes**. This plan only
covers making Supabase email confirmation work properly. Today the dashboard
has confirmation **ON** while the app was designed for OFF, so signup ends at
"check your email" with no in-app route to receive the confirmation click —
and the docs (CLAUDE.md/README) still describe confirmation as intentionally
disabled. Update them when this lands.

## Known issues this plan resolves

1. **No confirm route in the app.** The email's confirmation link currently
   points at the default Site URL with no handler, so clicking it doesn't
   reliably produce a logged-in session.
2. **Built-in email sender is rate-limited** (~2–4 emails/hour; we hit
   "email rate limit exceeded" during E2E on 2026-07-14). Production
   requires custom SMTP.
3. Supabase rejects `@example.com` addresses — use real-looking domains in
   tests, or mint users/links via the admin API.

## App-side changes (code)

1. **New route `app/auth/confirm/route.ts`** (GET, nodejs, force-dynamic):
   - Read `token_hash` and `type` from the query string.
   - `createClient()` (lib/supabase/server.ts) →
     `supabase.auth.verifyOtp({ type, token_hash })` — the PKCE/token-hash
     flow recommended for `@supabase/ssr`; it sets the session cookies.
   - Success → `NextResponse.redirect(new URL("/pay", request.url))`
     (new users are unpaid; going straight to the paywall beats bouncing
     through /login). The proxy would redirect there anyway — this is just
     the direct path.
   - Failure (expired/used token) → redirect to `/login?error=confirm`
     (add a small notice on the login page for that query param).
2. **`lib/supabase/proxy.ts`**: add `"/auth"` to `PUBLIC_PATHS` (the confirm
   link is clicked while logged out). Keep it out of `UNPAID_ALLOWED`
   concerns — confirm always precedes payment.
3. **`app/signup/page.tsx`**: the `needsConfirmation` branch already renders
   "check your email"; update the copy to mention they'll land on the
   subscription page after confirming.
4. **Docs**: CLAUDE.md "Auth (Supabase)" section and README "Accounts"
   section — email confirmation becomes intentionally **enabled**; describe
   the confirm route and the signup → confirm → /pay → subscribe flow.

## Dashboard changes (owner action)

1. **Email template** — Supabase → Authentication → Emails → "Confirm
   signup": replace the link with:

   ```html
   <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">
     Confirm your email
   </a>
   ```

2. **URL configuration** — Authentication → URL Configuration:
   - Site URL: `http://localhost:3210` for local dev; the production domain
     (Vercel) at go-live. Add both to the redirect allowlist.
3. **Custom SMTP (required for production)** — Project Settings → Auth →
   SMTP: configure a provider (e.g. Resend, Postmark, SES). Without this,
   the built-in sender's rate limit stalls real signups.
4. Leave "Confirm email" **ON** (Authentication → Sign In / Providers →
   Email). Note: today it is ON while the app expects OFF — if users need
   to sign up before this plan is implemented, either turn it OFF
   temporarily or confirm users manually via the admin API.

## Testing notes (no inbox needed)

- Mint confirmation links via the admin API instead of reading email:
  `POST /auth/v1/admin/generate_link` with
  `{"type": "signup", "email": ..., "password": ...}` (service key auth)
  returns `action_link` / `hashed_token` — drive
  `/auth/confirm?token_hash=<hashed_token>&type=email` with Playwright.
- Full E2E: signup → "check your email" screen → generate link (admin) →
  confirm route → lands on `/pay` logged in → Stripe test checkout
  (4242 4242 4242 4242) → app unlocked. Re-run the lapse/lock-out checks
  unchanged.
- Existing E2E learnings: Supabase admin can also confirm directly
  (`PUT /auth/v1/admin/users/{id}` `{"email_confirm": true}`) — useful for
  setup shortcuts, but the generate_link path is the one that exercises the
  new route.

## Flow after implementation

```
/signup ──► "check your email" ──► email link ──► /auth/confirm (verifies,
logs in) ──► /pay ──► Stripe Payment Link ──► /payment/success ──► app
```

Unconfirmed users cannot log in; confirmed-but-unpaid users are held at
`/pay`; lapsed subscribers are locked out at period end (already live).
