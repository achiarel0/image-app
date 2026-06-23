import { NextResponse } from "next/server";

// This route runs on the server only. It proxies the upload to the n8n
// webhook so the webhook URL stays a server-side secret and never reaches
// the browser bundle.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
// n8n image generation can be slow; allow a generous-but-bounded wait.
const UPSTREAM_TIMEOUT_MS = 120_000;

function maxBytes(): number {
  const raw = Number(process.env.MAX_UPLOAD_BYTES);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_MAX_BYTES;
}

// All client-facing failures use this generic message — never leak upstream
// error details, URLs, or stack traces to the browser.
function fail(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

function validateImage(value: FormDataEntryValue | null, name: string): File | string {
  if (!value || typeof value === "string") {
    return `Missing ${name}.`;
  }
  const file = value as File;
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return "Please upload JPEG, PNG, or WebP only.";
  }
  if (file.size === 0) {
    return `${name} is empty.`;
  }
  if (file.size > maxBytes()) {
    return "Each image must be 10 MB or smaller.";
  }
  return file;
}

export async function POST(request: Request) {
  const webhookUrl = process.env.WEBHOOK_URL;
  if (!webhookUrl) {
    // Misconfiguration — log server-side, stay vague to the client.
    console.error("WEBHOOK_URL is not set");
    return fail(500, "Server is not configured. Please try again later.");
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(400, "Invalid request.");
  }

  const image1 = validateImage(form.get("image1"), "image1");
  if (typeof image1 === "string") return fail(400, image1);

  const image2 = validateImage(form.get("image2"), "image2");
  if (typeof image2 === "string") return fail(400, image2);

  // Forward only the two validated files — nothing else from the client.
  const outgoing = new FormData();
  outgoing.append("image1", image1, image1.name || "image1");
  outgoing.append("image2", image2, image2.name || "image2");

  let upstream: Response;
  try {
    upstream = await fetch(webhookUrl, {
      method: "POST",
      body: outgoing,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (err) {
    console.error("Webhook request failed:", err);
    return fail(502, "Failed to generate image. Please try again.");
  }

  if (!upstream.ok) {
    console.error("Webhook returned status", upstream.status);
    return fail(502, "Failed to generate image. Please try again.");
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    console.error("Webhook returned non-image content-type:", contentType);
    return fail(502, "Failed to generate image. Please try again.");
  }

  // Stream the binary image straight back to the client.
  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
      "Content-Disposition": "inline",
    },
  });
}

// Reject everything that isn't POST with a clean 405.
export function GET() {
  return fail(405, "Method not allowed.");
}
