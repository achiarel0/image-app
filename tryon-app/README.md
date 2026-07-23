# AI Virtual Try-On

A single-page app that blends two images into one. The user uploads a photo of a person
and a garment; the images are sent to an [n8n](https://n8n.io) webhook that performs the AI
synthesis, and the generated image is displayed with a download option.

Built with **Next.js 16** (App Router), **React 19**, **Tailwind CSS v4**, and TypeScript.
Styled to match a minimal, RINASCENTE-inspired reference design.

> **Note:** This app lives in the `tryon-app/` subfolder of the repo because the repo root
> folder name contains a space (which npm rejects as a package name). Run all commands from
> here, and when deploying to Vercel set the project's **Root Directory** to `tryon-app`.

## Getting started

```bash
npm install
cp .env.example .env.local   # then edit .env.local with your webhook URL
npm run dev -- -p 3210       # http://localhost:3210
```

Port 3000 is frequently occupied by another local app, so the examples use `3210` — use any
free port you like.

### Environment variables

| Variable                                | Required | Description                                                              |
| --------------------------------------- | -------- | ------------------------------------------------------------------------ |
| `WEBHOOK_URL`                            | Yes      | The n8n webhook that performs image synthesis. **Server-only** secret.   |
| `MAX_UPLOAD_BYTES`                       | No       | Max bytes per uploaded image. Defaults to `10485760` (10 MB).            |
| `NEXT_PUBLIC_SUPABASE_URL`               | Yes      | Supabase project URL (safe to expose to the browser).                    |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`   | Yes      | Supabase publishable key (`sb_publishable_...`, safe to expose).         |
| `STRIPE_SECRET_KEY`                      | Yes      | Stripe API key used to verify checkouts/subscriptions. **Server-only.**  |
| `SUPABASE_SECRET_KEY`                    | Yes      | Supabase secret (service-role) key; grants entitlements. **Server-only.**|
| `STRIPE_PAYMENT_LINK_URL`                | Yes      | The Stripe Payment Link users subscribe through. Server-only.            |
| `STRIPE_PAYMENT_LINK_ID`                 | Yes      | The payment link id (`plink_...`), for the "already subscribed" recheck. |

`WEBHOOK_URL` has **no** `NEXT_PUBLIC_` prefix on purpose — that keeps it on the server and
out of the browser bundle. Set it locally in `.env.local` (gitignored) and, for production,
in your Vercel project settings. See `.env.example`.

## Scripts

```bash
npm run dev      # Dev server with Turbopack (hot reload)
npm run build    # Production build — also runs TypeScript + ESLint checks
npm run start    # Serve the production build
npm run lint     # ESLint
```

There is no test suite; `npm run build` is the gate for type and lint correctness.

## How it works

```
Browser (app/page.tsx)
   │  POST multipart/form-data { image1, image2 }
   ▼
Server route (app/api/generate/route.ts)   ← holds WEBHOOK_URL (server-only)
   │  validates files, forwards request
   ▼
n8n webhook  →  returns a binary image  →  streamed back to the browser  →  <img> + download
```

- **The browser never calls the webhook directly.** It POSTs to the internal
  `/api/generate` route, which holds the webhook URL as a server-only secret and proxies the
  request. This keeps the URL out of the client bundle.
- **Validation is enforced on the server** (authoritative): both files required, MIME
  allowlist (JPEG / PNG / WebP), and a per-file size cap. The matching client-side checks
  are for fast UX feedback only. The route also enforces an upstream timeout and returns
  generic error messages (real errors are logged server-side).
- **The binary response** is streamed back, read as a `Blob`, turned into an object URL, and
  shown in a plain `<img>` (with a download link). `next/image` is intentionally not used —
  it doesn't support `blob:` URLs.

### Shop the Look (garment gallery)

Below the upload row, a "Or Pick a Garment" gallery lets users click a pre-shot garment
instead of uploading their own. The catalog is `app/garments.ts` — an array of
`{ id, name, src }` pointing at static images in `public/garments/`. Clicking a card fetches
that image, wraps it in a `File` (same shape a manual upload produces), and drops it straight
into the garment slot — it goes through the same client + server validation as an uploaded
file. Add a garment by dropping an image into `public/garments/` and adding one entry to
`GARMENTS`; no other wiring is needed.

## Accounts (Supabase auth)

Login is **required** — powered by [Supabase Auth](https://supabase.com/docs/guides/auth)
with cookie-based sessions (`@supabase/ssr`):

- `/signup` — create an account with **name, email, and password** (the name is stored in
  the auth user's metadata), then continue to the subscription page.
- `/login` — sign in with email + password. The header shows the signed-in user's name and
  a sign-out button.
- `proxy.ts` (Next.js 16's renamed middleware) refreshes the session cookie on every
  request and redirects logged-out visitors to `/login` (only `/login` and `/signup` are
  public); client/server Supabase helpers live in `lib/supabase/`.
- `/api/generate` independently rejects unauthenticated requests with a 401 — the route
  check is authoritative, the proxy redirect is UX.
- **Email confirmation:** the app was designed for confirmation **off** (signup logs the
  user in immediately), but the Supabase dashboard currently has it **on**, which leaves
  signups at "check your email" with no confirm route in the app to handle the link. See
  `docs/email-confirmation-plan.md` for the plan to support confirmation properly. Until
  then, turn it off (Authentication → Sign In / Providers → Email → "Confirm email") or
  confirm users manually via the admin API.

## Payments ($9.99/month via Stripe)

Access requires an active **$9.99/month subscription** bought through a Stripe Payment
Link. When a subscriber stops paying, access ends with the billing period.

```
signup → /pay (paywall) → Stripe Payment Link (client_reference_id = user id)
      → /payment/success?session_id=… (server verifies with Stripe, grants entitlement)
      → JWT refresh → the studio
```

- **Entitlement** lives in the Supabase auth user's `app_metadata`:
  `{ stripe_customer_id, stripe_subscription_id, paid_until }`, where `paid_until` mirrors
  the Stripe subscription's `current_period_end`. It travels in the JWT, so the proxy can
  gate every request without any DB or Stripe call.
- **Lapse → revalidation, no webhooks.** When `paid_until` passes, the proxy sends the user
  to `/payment/revalidate`, which asks Stripe: still active (they renewed) → `paid_until`
  is extended and the session refreshes seamlessly; canceled/past-due/unpaid → back to
  `/pay`. `/api/generate` performs the same check authoritatively (402 when unpaid, with
  one inline revalidation attempt for stale JWTs).
- **Audit trail:** each completed checkout is recorded in the `public.payments` table
  (RLS: users can read only their own rows; only the service role writes).
- **Verification is server-side.** `/payment/success` retrieves the checkout session from
  Stripe with the secret key; forged or unpaid sessions grant nothing. Activation is
  idempotent (`unique(stripe_session_id)`), so reloading the page is safe.
- **Recovery:** if the redirect back from Stripe never happens, "Already subscribed? Check
  again" on `/pay` (`/payment/recheck`) finds the completed checkout by
  `client_reference_id` and finishes activation. This matters in test mode: the payment
  link's after-completion redirect is fixed to `http://localhost:3210/payment/success`, so
  paying while no dev server is running (or from a deployed preview) shows "site can't be
  reached" — the payment still succeeded; recover via `/payment/recheck` or by opening the
  success URL once the server is up.
- Self-serve cancelation (optional): enable Stripe's no-code
  [customer portal](https://docs.stripe.com/customer-management/activate-no-code-customer-portal)
  and share its login link; lock-out works regardless, at period end.

### Testing in test mode

The committed setup runs Stripe in **test mode** (`sk_test_` key, `buy.stripe.com/test_...`
link) — real cards are rejected and no money can move. Subscribe with Stripe's test cards:
`4242 4242 4242 4242` (success), any future expiry, any CVC, any billing details. Useful
failure cards: `4000 0000 0000 0002` (decline), `4000 0025 0000 3155` (3-D Secure).
Deploying with the same test-mode env values keeps the deployed site test-only too.

### Going live (currently test mode)

1. In Stripe **live mode**, create the product + $9.99/month recurring price + payment
   link, with the link's after-completion redirect set to
   `https://<your-domain>/payment/success?session_id={CHECKOUT_SESSION_ID}`.
2. In Vercel, set `STRIPE_SECRET_KEY` (live), `STRIPE_PAYMENT_LINK_URL` +
   `STRIPE_PAYMENT_LINK_ID` (live link), and `SUPABASE_SECRET_KEY`, then redeploy.
3. Never mix modes: a live key cannot see `cs_test_` sessions or test subscriptions.
4. Smoke-test with a real card, then refund/cancel from the Stripe dashboard.
5. Optional hardening: add `checkout.session.completed` / `customer.subscription.*`
   webhooks for instant revocation instead of waiting for `paid_until` to lapse.

## Security

- Webhook URL kept server-side (never shipped to the browser).
- Server-side file validation: type allowlist, size cap, required fields.
- Bounded upstream timeout via `AbortSignal.timeout`; generic client-facing errors.
- Hardening headers set in `next.config.ts` for all routes: Content-Security-Policy,
  `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and
  HSTS; the `x-powered-by` header is disabled.

## Deploy on Vercel

1. Import the repo into Vercel and set **Root Directory** to `tryon-app`.
2. Add the `WEBHOOK_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `SUPABASE_SECRET_KEY`,
   `STRIPE_PAYMENT_LINK_URL`, and `STRIPE_PAYMENT_LINK_ID` environment variables (and
   optionally `MAX_UPLOAD_BYTES`). Use live-mode Stripe values (see "Going live").
3. Deploy — the framework is auto-detected as Next.js (zero config otherwise).
