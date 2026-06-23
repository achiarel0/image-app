# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project layout

This repo root (`X:\app frontend`) holds the product specs (`frontend.md`, `frontendprd.txt`, `hatwebsitestyle.png`) plus the actual application in the `tryon-app/` subfolder. The app lives in a subfolder because the root folder name contains a space, which npm rejects as a package name.

The app is just three files of real code under `tryon-app/app/`: `page.tsx` (the entire UI, a client component), `api/generate/route.ts` (the server proxy to the webhook), and `layout.tsx` + `globals.css` (shell/styling). User-facing docs live in `tryon-app/README.md`.

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

**Required env var:** `WEBHOOK_URL` (server-only — do **not** add a `NEXT_PUBLIC_` prefix or it leaks to the browser). Set it in the Vercel project settings and in `tryon-app/.env.local` for local dev. See `.env.example`. Optional: `MAX_UPLOAD_BYTES` (default 10 MB).

## Architecture

A single-page "AI Virtual Try-On" app: the user uploads two images (a person + a garment), they are POSTed to an external n8n webhook as `multipart/form-data`, and the single binary image returned is displayed.

- **Stack:** Next.js 16 (App Router, Turbopack) + React 19 + Tailwind CSS v4 + TypeScript.
- **Client → server proxy → webhook.** The browser (`app/page.tsx`, a `'use client'` component) never calls the n8n webhook directly. It POSTs the FormData to our own route handler `app/api/generate/route.ts`, which holds the webhook URL as a server-only secret and forwards the request. This keeps the URL out of the client bundle. **Do not** revert the page to calling the webhook URL directly, and **do not** expose the URL via `NEXT_PUBLIC_`.
- **The webhook contract is fixed by the spec** (see `frontend.md` §5 / `frontendprd.txt` §4.2): the FormData keys `image1` / `image2` must not change, and neither the page nor the route sets a manual `Content-Type` (the runtime must set the multipart boundary).
- **Validation is enforced server-side** in `route.ts` (MIME allowlist `image/jpeg|png|webp`, per-file size cap, both files required) — this is authoritative. The matching client-side checks in `page.tsx` are UX-only and spoofable. The route returns generic error messages and logs real failures server-side; it also enforces an upstream timeout via `AbortSignal.timeout`.
- **Binary response handling:** the route streams the raw image back; the client reads it via `response.blob()` → `URL.createObjectURL(blob)` and assigns it to a plain `<img>` `src`. `next/image` is intentionally avoided because it does not support `blob:` URLs.
- **Object URL lifecycle:** every `createObjectURL` (upload previews and the result) is paired with `revokeObjectURL` when the value is replaced, to avoid leaks. Preserve this when editing upload/result logic.

### Security headers

`next.config.ts` sets a CSP and the standard hardening headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS) on all routes, and disables `x-powered-by`. The CSP allows `'unsafe-eval'` in **development only** (HMR needs it); script `'unsafe-inline'` is a pragmatic tradeoff since there is no nonce setup. Changing `next.config.ts` requires a dev-server restart to take effect.

### Tailwind v4 note

Styling uses Tailwind v4, configured entirely in `app/globals.css` via `@import "tailwindcss"` and `@theme` — there is **no `tailwind.config.js`**. The default dark-mode theme was removed so the UI is always light, matching the RINASCENTE-style reference screenshot.

## Next.js 16 caveat

This is Next.js 16, which has breaking changes versus older versions in training data. Before writing framework code, consult the bundled docs at `tryon-app/node_modules/next/dist/docs/` (see `tryon-app/AGENTS.md`).
