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

| Variable           | Required | Description                                                              |
| ------------------ | -------- | ------------------------------------------------------------------------ |
| `WEBHOOK_URL`      | Yes      | The n8n webhook that performs image synthesis. **Server-only** secret.   |
| `MAX_UPLOAD_BYTES` | No       | Max bytes per uploaded image. Defaults to `10485760` (10 MB).            |

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

## Security

- Webhook URL kept server-side (never shipped to the browser).
- Server-side file validation: type allowlist, size cap, required fields.
- Bounded upstream timeout via `AbortSignal.timeout`; generic client-facing errors.
- Hardening headers set in `next.config.ts` for all routes: Content-Security-Policy,
  `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and
  HSTS; the `x-powered-by` header is disabled.

## Deploy on Vercel

1. Import the repo into Vercel and set **Root Directory** to `tryon-app`.
2. Add the `WEBHOOK_URL` environment variable (and optionally `MAX_UPLOAD_BYTES`).
3. Deploy — the framework is auto-detected as Next.js (zero config otherwise).
