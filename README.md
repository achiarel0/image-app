# AI Virtual Try-On

A single-page web app that blends two images into one: upload a photo of a person and a
garment, and an AI-generated try-on image comes back, ready to view and download.

Built with **Next.js 16** (App Router) · **React 19** · **Tailwind CSS v4** · TypeScript.

> **The application lives in [`tryon-app/`](tryon-app/)** — see its
> [README](tryon-app/README.md) for setup, environment variables, architecture, and
> deployment details. (The app sits in a subfolder because the repo root's folder name
> contains a space, which npm rejects as a package name.)

## Quick start

```bash
cd tryon-app
npm install
cp .env.example .env.local   # then set WEBHOOK_URL
npm run dev
```

## How it works

```
Browser → /api/generate (server proxy, holds the webhook secret) → n8n webhook → image
```

The browser never talks to the AI webhook directly — a server route validates the uploads
(type allowlist, size cap) and proxies the request, keeping the webhook URL out of the
client bundle.

## Repo layout

| Path                | Contents                                      |
| ------------------- | --------------------------------------------- |
| `tryon-app/`        | The Next.js application                       |
| `frontend.md`       | Frontend spec                                 |
| `frontendprd.txt`   | Product requirements document                 |
| `hatwebsitestyle.png` | Style reference screenshot                  |

## Deploying

Deploys to Vercel: set the project's **Root Directory** to `tryon-app` and add the
`WEBHOOK_URL` environment variable. See [`tryon-app/README.md`](tryon-app/README.md#deploy-on-vercel).
