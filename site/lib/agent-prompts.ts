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
