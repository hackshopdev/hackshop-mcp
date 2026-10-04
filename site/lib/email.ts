import "server-only";

// Transactional email through Resend's REST API. RESEND_API_KEY is the team's
// shared key (linked to this project on Vercel); RESEND_FROM must use a domain
// verified in Resend.

const RESEND_URL = "https://api.resend.com/emails";
const DEFAULT_FROM = "hackshop <builds@hackshop.dev>";

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export function fromAddress(): string {
  return process.env.RESEND_FROM?.trim() || DEFAULT_FROM;
}

export type SendResult =
  | { ok: true; id: string | null }
  | { ok: false; status: number; error: string };

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey?: string;
  tags?: Array<{ name: string; value: string }>;
}): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return { ok: false, status: 503, error: "email_not_configured" };
  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        tags: input.tags,
      }),
      signal: AbortSignal.timeout(8_000),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
    if (!res.ok) {
      console.error(`[email] resend ${res.status}: ${data.name ?? ""} ${data.message ?? ""}`);
      return { ok: false, status: res.status, error: data.name ?? "send_failed" };
    }
    return { ok: true, id: data.id ?? null };
  } catch (err) {
    console.error(`[email] resend error: ${(err as Error).message}`);
    return { ok: false, status: 502, error: "send_failed" };
  }
}
