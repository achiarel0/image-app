# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project layout

This repo root (`X:\app frontend`) holds the product specs (`frontend.md`, `frontendprd.txt`, `hatwebsitestyle.png`) plus the actual application in the `tryon-app/` subfolder. The app lives in a subfolder because the root folder name contains a space, which npm rejects as a package name.

The core app code lives under `tryon-app/app/`: `page.tsx` (the try-on UI, a client component), `api/generate/route.ts` (the server proxy to the webhook), `login/` + `signup/` + `components/` (Supabase auth UI), and `layout.tsx` + `globals.css` (shell/styling). Supabase client helpers are in `tryon-app/lib/supabase/`, and `tryon-app/proxy.ts` (Next.js 16's renamed middleware) refreshes auth sessions. User-facing docs live in `tryon-app/README.md`.

**All commands below must be run from `tryon-app/`**, not the repo root.

## Commands

```bash
cd tryon-app
npm run dev      # dev server (Turbopack). Port 3000 is often taken by another
                 # local app ("WealthTracker"); use: npm run dev -- -p 3210
npm run build    # production build — also runs full TypeScript + ESLint checks
npm run start    # serve the production build (npm run start -- -p 3210 for a free port)
npm run lint     # ESLint only
```

There is no test suite. `npm run build` is the gate for type/lint correctness.

## Vercel deployment

The deploy target is Vercel (the reason Next.js was chosen). When importing, **set the Vercel "Root Directory" to `tryon-app`** so it builds the subfolder, not the repo root.

**Required env vars:** `WEBHOOK_URL` (server-only — do **not** add a `NEXT_PUBLIC_` prefix or it leaks to the browser), plus `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (these two are intentionally public; the publishable key is safe to expose), plus the four payment vars — `STRIPE_SECRET_KEY`, `SUPABASE_SECRET_KEY` (service role — bypasses RLS, strictly server-only), `STRIPE_PAYMENT_LINK_URL`, `STRIPE_PAYMENT_LINK_ID` — all deliberately server-only with no `NEXT_PUBLIC_` prefix. Set them in the Vercel project settings and in `tryon-app/.env.local` for local dev. See `.env.example`. Optional: `MAX_UPLOAD_BYTES` (default 10 MB). Local dev uses Stripe **test mode**; production uses live-mode values (see README "Going live").

## Architecture

A single-page "AI Virtual Try-On" app: the user uploads two images (a person + a garment), they are POSTed to an external n8n webhook as `multipart/form-data`, and the single binary image returned is displayed.

- **Stack:** Next.js 16 (App Router, Turbopack) + React 19 + Tailwind CSS v4 + TypeScript.
- **Client → server proxy → webhook.** The browser (`app/page.tsx`, a `'use client'` component) never calls the n8n webhook directly. It POSTs the FormData to our own route handler `app/api/generate/route.ts`, which holds the webhook URL as a server-only secret and forwards the request. This keeps the URL out of the client bundle. **Do not** revert the page to calling the webhook URL directly, and **do not** expose the URL via `NEXT_PUBLIC_`.
- **The webhook contract is fixed by the spec** (see `frontend.md` §5 / `frontendprd.txt` §4.2): the FormData keys `image1` / `image2` must not change, and neither the page nor the route sets a manual `Content-Type` (the runtime must set the multipart boundary).
- **Validation is enforced server-side** in `route.ts` (MIME allowlist `image/jpeg|png|webp`, per-file size cap, both files required) — this is authoritative. The matching client-side checks in `page.tsx` are UX-only and spoofable. The route returns generic error messages and logs real failures server-side; it also enforces an upstream timeout via `AbortSignal.timeout`.
- **Binary response handling:** the route streams the raw image back; the client reads it via `response.blob()` → `URL.createObjectURL(blob)` and assigns it to a plain `<img>` `src`. `next/image` is intentionally avoided because it does not support `blob:` URLs.
- **Object URL lifecycle:** every `createObjectURL` (upload previews and the result) is paired with `revokeObjectURL` when the value is replaced, to avoid leaks. Preserve this when editing upload/result logic.
- **Garment gallery ("Shop the Look"):** `tryon-app/app/garments.ts` lists pre-shot garments (`{ id, name, src }`) served from `tryon-app/public/garments/`. Clicking a gallery card in `page.tsx` fetches that static image, wraps it in a `File`, and drops it into the garment slot — it's indistinguishable from a manual upload to the rest of the flow (same client checks, same server-side validation in `route.ts`). Its preview is the static `/garments/...` path rather than an object URL, so no `revokeObjectURL` is needed for it (revoking a non-blob URL is a documented no-op, which is what makes swapping between an uploaded file and a gallery pick safe). Add a garment by dropping an image in `public/garments/` and adding one entry to `GARMENTS`.

### Auth (Supabase)

Login is **required**: users sign up at `/signup` with name/email/password and log in at `/login`; `/payment/*` is also public (see Payments). Sessions are cookie-based via `@supabase/ssr`; the name lives in auth `user_metadata.full_name`. `lib/supabase/client.ts` (browser) and `lib/supabase/server.ts` (server components/routes) create the clients; `lib/supabase/admin.ts` creates the **service-role** client (entitlement writes only — never import client-side). `proxy.ts` at the app root calls `lib/supabase/proxy.ts`'s `updateSession`, which refreshes tokens on every request and redirects logged-out visitors to `/login` (API paths get a 401 instead). `app/api/generate/route.ts` re-checks auth itself — like file validation, the route-level check is the authoritative one; the proxy redirect is UX. Use `getClaims()`, never trust `getSession()` server-side. **Email confirmation:** the app was built expecting it **disabled** (signup logs users in immediately and continues to `/pay`), but as of 2026-07-16 the Supabase dashboard has it **enabled**, so signups stall at "check your email" — there is no confirm route in the app yet. `tryon-app/docs/email-confirmation-plan.md` is the plan to support confirmation properly (not implemented); until it lands, either turn the setting off (Authentication → Sign In / Providers → Email → "Confirm email") or confirm users via the admin API (`PUT /auth/v1/admin/users/{id}` with `{"email_confirm": true}`, service key auth). The Supabase URL is added to the CSP `connect-src` in `next.config.ts` from `NEXT_PUBLIC_SUPABASE_URL`.

### Payments (Stripe subscription)

Access requires a **$9.99/month** subscription bought through a **Stripe Payment Link** (top-level `<a>` navigation — deliberately no Stripe.js/embed, so the CSP stays untouched; keep it that way). Entitlement lives in auth `app_metadata` (`stripe_customer_id`, `stripe_subscription_id`, `paid_until` = the subscription's `current_period_end`) and therefore rides in the JWT: the proxy gates on `paid_until` with **no DB/Stripe calls** (unpaid → `/pay`, lapsed-with-subscription → `/payment/revalidate`, unpaid API calls → 402). There are **no Stripe webhooks**: when `paid_until` lapses, `lib/payments.ts#revalidateSubscription` re-queries Stripe — renewed subs get extended silently, ended subs are locked out (`past_due` counts as out). `/api/generate` is the authoritative gate (402 + one inline revalidation attempt). `/payment/success` verifies the checkout session server-side (`lib/stripe.ts`, plain fetch — no stripe npm dep by design) and activates via `lib/payments.ts#activateFromSession`, idempotently (unique `stripe_session_id`); the user is identified by `client_reference_id`, so it works even logged-out. `/payment/recheck` recovers missed redirects; `SessionRefresher` client component refreshes the JWT after entitlement changes. Each purchase is recorded in the `public.payments` table (the **only** custom table; RLS select-own, service-role writes only). Flow: signup → `/pay` → Stripe → `/payment/success` → refresh → app. **Payment Link redirect caveat:** a Payment Link has one fixed after-completion redirect URL; the current test link points at `http://localhost:3210/payment/success?session_id={CHECKOUT_SESSION_ID}`, so checkouts completed while no dev server is running (or from a deployed site) end at "site can't be reached" — the payment still succeeds in Stripe, and activation is recovered via `/payment/recheck` or by replaying the success URL against a running server.

### Security headers

`next.config.ts` sets a CSP and the standard hardening headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS) on all routes, and disables `x-powered-by`. The CSP allows `'unsafe-eval'` in **development only** (HMR needs it); script `'unsafe-inline'` is a pragmatic tradeoff since there is no nonce setup. Changing `next.config.ts` requires a dev-server restart to take effect.

### Tailwind v4 note

Styling uses Tailwind v4, configured entirely in `app/globals.css` via `@import "tailwindcss"` and `@theme` — there is **no `tailwind.config.js`**. The default dark-mode theme was removed so the UI is always light, matching the RINASCENTE-style reference screenshot.

## Next.js 16 caveat

This is Next.js 16, which has breaking changes versus older versions in training data. Before writing framework code, consult the bundled docs at `tryon-app/node_modules/next/dist/docs/` (see `tryon-app/AGENTS.md`).
