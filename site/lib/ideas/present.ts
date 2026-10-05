import type { IdeaAnswers, IdeaSort, PublicIdea } from "./types";

// Pure helpers shared by the pages, API and tests. Client safe.

export const SITE_URL = "https://www.hackshop.dev";

export function ideaPath(id: string): string {
  return `/ideas/${id}`;
}

export function ideaUrl(id: string): string {
  return `${SITE_URL}${ideaPath(id)}`;
}

export function hideUrl(id: string, token: string): string {
  return `${SITE_URL}/api/ideas/${id}/hide?token=${encodeURIComponent(token)}`;
}

/** Title and description joined into one planner prompt. */
export function ideaPrompt(title: string, body: string): string {
  const head = title.trim();
  const tail = body.trim();
  if (!tail) return head;
  return /[.!?]$/.test(head) ? `${head} ${tail}` : `${head}. ${tail}`;
}

/** "Build this" link: the home planner prefilled with the idea and answers. */
export function buildThisHref(idea: Pick<PublicIdea, "title" | "body"> & IdeaAnswers): string {
  const params = new URLSearchParams();
  params.set("idea", ideaPrompt(idea.title, idea.body));
  if (idea.size) params.set("size", idea.size);
  if (idea.interaction) params.set("interaction", idea.interaction);
  if (idea.sensing) params.set("sensing", idea.sensing);
  if (idea.budget) params.set("budget", idea.budget);
  return `/?${params.toString()}#start`;
}

/** Top: most votes, then newest. New: newest first. Ties break on id. */
export function sortIdeas(ideas: ReadonlyArray<PublicIdea>, sort: IdeaSort): PublicIdea[] {
  return [...ideas].sort((a, b) => {
    if (sort === "top" && b.vote_count !== a.vote_count) return b.vote_count - a.vote_count;
    const time = Date.parse(b.created_at) - Date.parse(a.created_at);
    if (time !== 0) return time;
    return a.id.localeCompare(b.id);
  });
}

/** Ideas that share the most answers or the same suggested board. */
export function relatedIdeas(
  idea: PublicIdea,
  pool: ReadonlyArray<PublicIdea>,
  limit = 3,
): PublicIdea[] {
  const score = (other: PublicIdea) => {
    let points = 0;
    if (idea.suggested_device_id && other.suggested_device_id === idea.suggested_device_id) points += 3;
    if (idea.size && other.size === idea.size) points += 1;
    if (idea.interaction && other.interaction === idea.interaction) points += 1;
    if (idea.sensing && idea.sensing !== "none" && other.sensing === idea.sensing) points += 2;
    return points;
  };
  return pool
    .filter((other) => other.id !== idea.id)
    .map((other, index) => ({ other, points: score(other), index }))
    .filter((entry) => entry.points > 0)
    .sort((a, b) => b.points - a.points || a.index - b.index)
    .slice(0, limit)
    .map((entry) => entry.other);
}

export function voteLabel(count: number): string {
  return `${count} ${count === 1 ? "vote" : "votes"}`;
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export function formatIdeaDate(iso: string): string {
  const time = Date.parse(iso);
  return Number.isFinite(time) ? DATE_FORMAT.format(new Date(time)) : "";
}
