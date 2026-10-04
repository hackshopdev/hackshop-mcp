// Ready-made prompts people paste into their own agent ("Tell my agent").
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

export const STORE_AGENT_PROMPT =
  "Help me buy the parts for a Muse gadget. Read https://www.hackshop.dev/store.json " +
  "(every board, its parts, seller links and newest eBay listings). Ask me what I want " +
  "it to do or which board I picked, then make one shopping list with the best current " +
  "price for each item: new from the linked seller or Amazon, or used on eBay (check " +
  "condition and shipping). Show me the list with links and the total, and wait for my " +
  "OK before you add anything to a cart or check out. Amazon and eBay don't allow " +
  "automated carts or checkout, so give me those links to buy myself.";

export function buyEverythingPrompt(input: {
  name: string;
  deviceId: string;
  items?: Array<{ qty: number; name: string }>;
  idea?: string;
}): string {
  const need =
    input.items && input.items.length > 0
      ? ` I still need: ${input.items.map((item) => `${item.qty} × ${item.name}`).join("; ")}.`
      : "";
  const idea = input.idea?.trim() ? ` It's for: ${input.idea.trim()}` : "";
  return clampForUrl(
    `Buy everything I need to build my ${input.name} gadget for Muse. ` +
      `The shopping list is in ${SITE_URL}/build/${input.deviceId}/plan.json (shopping_list), ` +
      `and ${SITE_URL}/store.json has seller links and newest eBay listings.${need} ` +
      "For each item, find the best current price from the linked seller, Amazon or a " +
      "recent eBay listing (check condition and shipping). Give me one list with links " +
      "and the total, then wait for my OK. Only add to cart or check out after I approve " +
      "the exact items and total, and skip anything I already have. Amazon and eBay don't " +
      `allow automated carts or checkout, so give me those links to buy myself.${idea}`,
  );
}

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
