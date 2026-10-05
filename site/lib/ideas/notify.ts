import "server-only";
import { sendEmail, type SendResult } from "../email";
import { hideUrl, ideaUrl } from "./present";
import { answerChips, type PublicIdea } from "./types";

// Emails the site owner (CONTACT_TO_EMAIL) about each new idea with a
// one-click hide link. Failures are logged and never fail the submit.

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function newIdeaEmail(idea: PublicIdea, token: string, boardName: string | null) {
  const answers = answerChips(idea);
  const link = ideaUrl(idea.id);
  const hide = hideUrl(idea.id, token);
  const subject = `Hackshop idea: ${idea.title.replace(/\s+/g, " ").slice(0, 70)}`;

  const text = [
    "New idea on hackshop.dev/ideas. It is live now.",
    "",
    `Title: ${idea.title}`,
    `Posted as: ${idea.display_name}`,
    `Answers: ${answers.length > 0 ? answers.join(", ") : "none"}`,
    `Suggested board: ${boardName ?? idea.suggested_device_id ?? "none"}`,
    "",
    idea.body || "(no description)",
    "",
    `View: ${link}`,
    `Hide it: ${hide}`,
  ].join("\n");

  const html = [
    "<p>New idea on hackshop.dev/ideas. It is live now.</p>",
    `<p><strong>${escapeHtml(idea.title)}</strong></p>`,
    idea.body ? `<p>${escapeHtml(idea.body).replace(/\n/g, "<br />")}</p>` : "<p>(no description)</p>",
    "<dl>",
    `<dt>Posted as</dt><dd>${escapeHtml(idea.display_name)}</dd>`,
    `<dt>Answers</dt><dd>${answers.length > 0 ? escapeHtml(answers.join(", ")) : "none"}</dd>`,
    `<dt>Suggested board</dt><dd>${escapeHtml(boardName ?? idea.suggested_device_id ?? "none")}</dd>`,
    "</dl>",
    `<p><a href="${escapeHtml(link)}">View the idea</a></p>`,
    `<p><a href="${escapeHtml(hide)}">Hide this idea</a> (opens a confirm page, no sign-in)</p>`,
  ].join("");

  return { subject, text, html };
}

export async function notifyNewIdea(
  idea: PublicIdea,
  token: string,
  boardName: string | null,
): Promise<SendResult | { ok: false; status: 0; error: "no_recipient" }> {
  const to = process.env.CONTACT_TO_EMAIL?.trim();
  if (!to) return { ok: false, status: 0, error: "no_recipient" };
  try {
    const email = newIdeaEmail(idea, token, boardName);
    const result = await sendEmail({
      to,
      ...email,
      idempotencyKey: `idea-${idea.id}`,
      tags: [{ name: "kind", value: "idea" }],
    });
    if (!result.ok) console.error(`[ideas] notify failed: ${result.error}`);
    return result;
  } catch (err) {
    console.error(`[ideas] notify error: ${(err as Error).message}`);
    return { ok: false, status: 502, error: "send_failed" };
  }
}
