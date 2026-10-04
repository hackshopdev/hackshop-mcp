import { NextResponse } from "next/server";
import { sendEmail } from "../../../lib/email";
import { anonymousRequestId, captureServerEvent } from "../../../lib/serverAnalytics";

export const runtime = "nodejs";

const buckets = new Map<string, { count: number; resetAt: number }>();
const LIMIT_PER_HOUR = 5;
const HOUR_MS = 60 * 60 * 1000;

function takeSlot(id: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(id);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(id, { count: 1, resetAt: now + HOUR_MS });
    return true;
  }
  if (bucket.count >= LIMIT_PER_HOUR) return false;
  bucket.count += 1;
  return true;
}

function value(input: Record<string, unknown>, key: string): string {
  return typeof input[key] === "string" ? input[key].trim() : "";
}

function cleanSubject(message: string): string {
  return message.replace(/\s+/g, " ").slice(0, 60);
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function emailLooksValid(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  if (value(input, "company")) {
    return NextResponse.json({ ok: true });
  }

  const message = value(input, "message");
  if (message.length < 10 || message.length > 5000) {
    return NextResponse.json({ error: "invalid_message" }, { status: 400 });
  }

  const name = value(input, "name").slice(0, 120);
  const email = value(input, "email").slice(0, 254);
  if (email && !emailLooksValid(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  const to = process.env.CONTACT_TO_EMAIL?.trim();
  if (!to) {
    return NextResponse.json({ error: "contact_not_configured" }, { status: 503 });
  }

  const distinctId = anonymousRequestId(request);
  if (!takeSlot(distinctId)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const text = [
    "New hackshop contact message.",
    "",
    name ? `Name: ${name}` : "Name: not provided",
    email ? `Reply email: ${email}` : "Reply email: not provided",
    "",
    message,
  ].join("\n");

  const html = [
    "<p>New hackshop contact message.</p>",
    "<dl>",
    `<dt>Name</dt><dd>${name ? escapeHtml(name) : "not provided"}</dd>`,
    `<dt>Reply email</dt><dd>${email ? escapeHtml(email) : "not provided"}</dd>`,
    "</dl>",
    `<p>${escapeHtml(message).replace(/\n/g, "<br />")}</p>`,
  ].join("");

  const result = await sendEmail({
    to,
    subject: `hackshop contact: ${cleanSubject(message)}`,
    html,
    text,
    tags: [{ name: "kind", value: "contact" }],
  });

  void captureServerEvent({
    event: "contact_submitted",
    distinctId,
    properties: {
      ok: result.ok,
      has_name: Boolean(name),
      has_reply_email: Boolean(email),
    },
  }).catch(() => undefined);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error === "email_not_configured" ? "email_not_configured" : "email_failed" },
      { status: result.status === 503 ? 503 : 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
