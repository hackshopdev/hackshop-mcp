// Ready-made prompts people paste into their own agent ("Ask my agent").
// Kept in one place so the homepage, board pages, build pages and projects
// all hand off the same way.

export const SITE_URL = "https://www.hackshop.dev";

export const GENERAL_AGENT_PROMPT =
  "Go to https://www.hackshop.dev and help me build a body for you. " +
  "Read https://www.hackshop.dev/agents.md first. Ask me a few quick questions " +
  "about size, features and budget, pick a board, give me the full shopping list " +
  "with links (don't buy anything without asking me), then walk me through " +
  "putting it together and pairing it.";

export function boardAgentPrompt(input: { name: string; deviceId: string }): string {
  return (
    `Help me build a ${input.name} gadget for Muse. ` +
    `Read ${SITE_URL}/build/${input.deviceId}/build.md and follow it: ` +
    "confirm the parts with me, give me the shopping list with links " +
    "(ask before buying), then walk me through assembly, flashing and pairing."
  );
}

export const ASK_AGENT_BADGE = "Ask my agent";
export const ASK_AGENT_TITLE = "Ask my agent to help me build one";
export const ASK_AGENT_BLURB =
  "Paste this into Claude, ChatGPT or your agent. It asks what you want the gadget to do, helps you pick the board, lists the parts with prices, and walks you through setup. It never buys anything without your OK.";

// "Ask my agent to help me build one": the agent reads the build plan, asks a
// few questions, recommends a board, lists the parts with prices, and only
// buys after a clear yes to the exact order. Used on the store, project
// pages and build pages.
export function buildWithAgentPrompt(input: {
  name?: string;
  deviceId?: string;
  items?: Array<{ qty: number; name: string }>;
  idea?: string;
} = {}): string {
  const planUrl = input.deviceId
    ? `${SITE_URL}/build/${input.deviceId}/build.md`
    : `${SITE_URL}/agents.md`;
  const gadget = input.name ? `a ${input.name} gadget for Muse` : "a gadget for Muse";
  const items = (input.items ?? []).slice(0, 8);
  const need =
    items.length > 0
      ? ` I still need: ${items.map((item) => `${item.qty} × ${item.name}`).join("; ")}.`
      : "";
  // The idea goes up front and is capped, so the buying rules below are
  // never cut off by the chat-URL length limit.
  const ideaText = input.idea?.trim() ?? "";
  const idea = ideaText
    ? ` It's for: ${ideaText.length > 280 ? `${ideaText.slice(0, 279).trimEnd()}…` : `${ideaText.replace(/[.\s]+$/, "")}.`}`
    : "";
  const pick = input.name
    ? `3. Tell me if the ${input.name} is the right board or recommend a better one, and say why, including how hard it is to build.`
    : "3. Recommend a board and say why, including how hard it is to build.";
  return clampForUrl(
    `Help me build ${gadget}.${idea} ` +
      `1. Read ${planUrl}. ` +
      "2. Ask me 2 to 4 short questions: where it will live, how I'll use it (talk, touch, or light and button), " +
      "whether it should sense the room, and my budget. Skip anything I've already told you. " +
      `${pick} ` +
      `4. List each part with a seller link, its price and the total.${need} ` +
      '5. To buy: show me the exact items and total, then ask "Place this order for $<total> at <seller>?" ' +
      "and wait for a clear yes. If you can't check out on a site, or it doesn't allow automated checkout " +
      "(Amazon and eBay don't), give me the links instead. " +
      "6. Then walk me through flashing and pairing step by step, and tell me where to pick up next time.",
  );
}

/** @deprecated Use buildWithAgentPrompt. */
export const buyEverythingPrompt = buildWithAgentPrompt;

export const STORE_AGENT_PROMPT = buildWithAgentPrompt();

export function projectAgentPrompt(input: {
  name: string;
  deviceId: string;
  notes?: string;
  idea?: string;
}): string {
  let prompt = boardAgentPrompt(input);
  const idea = input.idea?.trim();
  const notes = input.notes?.trim();
  if (idea) prompt += ` What I want it to do: ${idea}`;
  if (notes) prompt += ` My notes: ${notes}`;
  return clampForUrl(prompt);
}

export function ideaAgentPrompt(idea: string): string {
  return clampForUrl(
    `${GENERAL_AGENT_PROMPT} Here's what I have in mind: ${idea.trim()}`,
  );
}

export type ChatTarget = "claude" | "chatgpt";

export function chatUrl(target: ChatTarget, prompt: string): string {
  const base = target === "claude" ? "https://claude.ai/new?q=" : "https://chatgpt.com/?q=";
  return `${base}${encodeURIComponent(prompt)}`;
}

// Keep generated chat URLs under ~2000 characters.
function clampForUrl(prompt: string): string {
  const max = 1400;
  if (encodeURIComponent(prompt).length <= max * 1.4) return prompt;
  let out = prompt;
  while (encodeURIComponent(out).length > max * 1.4 && out.length > 200) {
    out = out.slice(0, Math.floor(out.length * 0.9));
  }
  return `${out.trimEnd()}…`;
}
