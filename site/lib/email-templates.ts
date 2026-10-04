import type { BuildPlan } from "./build-plan/types";

// Pure email builders (no I/O) so they can be unit tested.

export interface ShoppingListEmail {
  subject: string;
  html: string;
  text: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function shoppingListEmail(input: {
  plan: BuildPlan;
  projectTitle?: string;
  projectUrl?: string | null;
  partIds?: Set<string> | null;
}): ShoppingListEmail {
  const { plan } = input;
  const items = plan.shopping_list.items.filter(
    (item) => !input.partIds || input.partIds.size === 0 || input.partIds.has(item.part_id),
  );
  const title = (input.projectTitle?.trim() || plan.name).slice(0, 120);
  const known = items.filter((item) => item.est_price_usd !== null && item.required);
  const total = known.reduce((sum, item) => sum + (item.est_price_usd ?? 0) * item.qty, 0);
  const storeUrl = "https://www.hackshop.dev/store";
  const projectUrl = safeUrl(input.projectUrl ?? null);

  const subject = `Shopping list: ${title}`;

  const textLines = [
    `Shopping list for ${title}`,
    "",
    ...items.map((item) => {
      const price = item.est_price_usd !== null ? ` (~$${item.est_price_usd})` : "";
      const optional = item.required ? "" : " (optional)";
      const url = safeUrl(item.url);
      return `- ${item.qty} × ${item.name}${optional}${price}${url ? `\n  ${url}` : ""}`;
    }),
    "",
    total > 0 ? `About $${Math.round(total)} for the required parts.` : "",
    `Compare new and used prices: ${storeUrl}`,
    projectUrl ? `Your build: ${projectUrl}` : `Build steps: ${plan.urls.build_page}`,
    "",
    "hackshop doesn't sell hardware. Links go to the seller, Amazon or eBay.",
  ].filter((line, index, lines) => line !== "" || lines[index - 1] !== "");

  const rows = items
    .map((item) => {
      const url = safeUrl(item.url);
      const name = escapeHtml(`${item.qty} × ${item.name}`);
      const label = url ? `<a href="${escapeHtml(url)}" style="color:#c25e00">${name}</a>` : name;
      const optional = item.required ? "" : ' <span style="color:#888">(optional)</span>';
      const price = item.est_price_usd !== null ? `~$${item.est_price_usd}` : "";
      return `<tr><td style="padding:8px 0;border-bottom:1px solid #eee">${label}${optional}</td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;color:#555">${price}</td></tr>`;
    })
    .join("");

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f6f4;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#111">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:24px">
<p style="margin:0 0 4px;color:#c25e00;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">hackshop</p>
<h1 style="margin:0 0 16px;font-size:22px">Shopping list: ${escapeHtml(title)}</h1>
<table style="width:100%;border-collapse:collapse;font-size:15px">${rows}</table>
${total > 0 ? `<p style="margin:16px 0 0;font-weight:700">About $${Math.round(total)} for the required parts.</p>` : ""}
<p style="margin:16px 0 0"><a href="${storeUrl}" style="color:#c25e00">Compare new and used prices in the store</a></p>
<p style="margin:8px 0 0"><a href="${escapeHtml(projectUrl ?? plan.urls.build_page)}" style="color:#c25e00">${projectUrl ? "Open your build" : "See the build steps"}</a></p>
<p style="margin:20px 0 0;color:#888;font-size:12px">hackshop doesn't sell hardware. Links go to the seller, Amazon or eBay.</p>
</div></body></html>`;

  return { subject, html, text: textLines.join("\n") };
}

export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!user || !domain) return "your email";
  return `${user.slice(0, 2)}${"•".repeat(Math.max(1, Math.min(6, user.length - 2)))}@${domain}`;
}
