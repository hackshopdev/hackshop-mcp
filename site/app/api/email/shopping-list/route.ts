import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { clerkEnabled } from "../../../../lib/auth-config";
import { buildPlanForDevice } from "../../../../lib/build-plan-data";
import { isEmailConfigured, sendEmail } from "../../../../lib/email";
import { maskEmail, shoppingListEmail } from "../../../../lib/email-templates";
import { anonymousRequestId, captureServerEvent } from "../../../../lib/serverAnalytics";

// Emails a build's shopping list to the signed-in user's own verified email.
// Never to an arbitrary address, so it can't be used to send mail to others.

export const runtime = "nodejs";

const buckets = new Map<string, { count: number; resetAt: number }>();
const LIMIT_PER_HOUR = 5;
const HOUR_MS = 60 * 60 * 1000;

function takeSlot(userId: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(userId);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(userId, { count: 1, resetAt: now + HOUR_MS });
    return true;
  }
  if (bucket.count >= LIMIT_PER_HOUR) return false;
  bucket.count += 1;
  return true;
}

export async function POST(request: Request) {
  if (!clerkEnabled) return NextResponse.json({ error: "sign_in_unavailable" }, { status: 503 });
  if (!isEmailConfigured()) return NextResponse.json({ error: "email_not_configured" }, { status: 503 });

  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "sign_in_required" }, { status: 401 });

  let body: {
    device_id?: unknown;
    project_id?: unknown;
    project_title?: unknown;
    part_ids?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const deviceId = typeof body.device_id === "string" ? body.device_id : "";
  const plan = buildPlanForDevice(deviceId);
  if (!plan) return NextResponse.json({ error: "unknown_device" }, { status: 400 });

  const projectId =
    typeof body.project_id === "string" && /^[A-Za-z0-9-]{1,64}$/.test(body.project_id)
      ? body.project_id
      : null;
  const projectTitle =
    typeof body.project_title === "string" ? body.project_title.slice(0, 120) : undefined;
  const partIds = Array.isArray(body.part_ids)
    ? new Set(body.part_ids.filter((id): id is string => typeof id === "string").slice(0, 50))
    : null;

  if (!takeSlot(userId)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const user = await currentUser();
  const email =
    user?.primaryEmailAddress?.verification?.status === "verified"
      ? user.primaryEmailAddress.emailAddress
      : null;
  if (!email) return NextResponse.json({ error: "no_verified_email" }, { status: 400 });

  const message = shoppingListEmail({
    plan,
    projectTitle,
    projectUrl: projectId ? `https://www.hackshop.dev/projects/${projectId}` : null,
    partIds,
  });
  const result = await sendEmail({
    to: email,
    subject: message.subject,
    html: message.html,
    text: message.text,
    tags: [
      { name: "kind", value: "shopping_list" },
      { name: "device", value: deviceId.replace(/[^a-z0-9_-]/gi, "_").slice(0, 60) },
    ],
  });

  void captureServerEvent({
    event: "shopping_list_emailed",
    distinctId: anonymousRequestId(request),
    properties: {
      device_id: deviceId,
      ok: result.ok,
      items: partIds?.size ?? plan.shopping_list.items.length,
      surface: "project_page",
    },
  }).catch(() => undefined);

  if (!result.ok) {
    return NextResponse.json({ error: "email_failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true, to: maskEmail(email) });
}
