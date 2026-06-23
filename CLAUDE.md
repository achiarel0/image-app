# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project layout

This repo root (`X:\app frontend`) holds the product specs (`frontend.md`, `frontendprd.txt`, `hatwebsitestyle.png`) plus the actual application in the `tryon-app/` subfolder. The app lives in a subfolder because the root folder name contains a space, which npm rejects as a package name.

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

The deploy target is Vercel (the reason Next.js was chosen). When importing, **set the Vercel "Root Directory" to `tryon-app`** so it builds the subfolder, not the repo root. No environment variables are required — the webhook URL is hardcoded.

## Architecture

A single-page "AI Virtual Try-On" app: the user uploads two images (a person + a garment), they are POSTed to an external n8n webhook as `multipart/form-data`, and the single binary image returned is displayed.

- **Stack:** Next.js 16 (App Router, Turbopack) + React 19 + Tailwind CSS v4 + TypeScript.
- **Everything is client-side.** `app/page.tsx` is the entire app and is a single `'use client'` component — there is no backend route, no server component logic, no data fetching on the server. The browser talks directly to the webhook.
- **The webhook contract is fixed by the spec** (see `frontend.md` §5 / `frontendprd.txt` §4.2). `WEBHOOK_URL` in `app/page.tsx` and the FormData keys `image1` / `image2` must not change. Do **not** set a manual `Content-Type` header — the browser must set the multipart boundary itself.
- **Binary response handling:** the webhook returns a raw image. It is read via `response.blob()` → `URL.createObjectURL(blob)` and assigned to a plain `<img>` `src`. `next/image` is intentionally avoided because it does not support `blob:` URLs.
- **Object URL lifecycle:** every `createObjectURL` (upload previews and the result) is paired with `revokeObjectURL` when the value is replaced, to avoid leaks. Preserve this when editing upload/result logic.
- **File validation** is by MIME type against `ACCEPTED_TYPES` (`image/jpeg`, `image/webp`); invalid files are rejected inline and never stored in state.

### Tailwind v4 note

Styling uses Tailwind v4, configured entirely in `app/globals.css` via `@import "tailwindcss"` and `@theme` — there is **no `tailwind.config.js`**. The default dark-mode theme was removed so the UI is always light, matching the RINASCENTE-style reference screenshot.

## Next.js 16 caveat

This is Next.js 16, which has breaking changes versus older versions in training data. Before writing framework code, consult the bundled docs at `tryon-app/node_modules/next/dist/docs/` (see `tryon-app/AGENTS.md`).
