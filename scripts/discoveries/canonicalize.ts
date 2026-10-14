import { createHash } from "node:crypto";

export type DiscoveredPost = {
  id: string;
  url: string;
  text: string;
  author?: string;
  publishedAt?: string;
  links: string[];
};

const X_HOSTS = new Set(["x.com", "www.x.com", "twitter.com", "www.twitter.com", "mobile.twitter.com"]);

export function canonicalSourceUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("invalid_source_url");
  if (X_HOSTS.has(url.hostname.toLowerCase())) {
    const id = url.pathname.match(/\/(?:status|statuses)\/(\d{8,25})(?:\/|$)/)?.[1];
    if (!id) throw new Error("not_public_x_post");
    return `https://x.com/i/status/${id}`;
  }
  url.hostname = url.hostname.toLowerCase();
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_|fbclid$|gclid$|ref$|s$)/i.test(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  if (url.hostname === "github.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length >= 2) {
      parts[0] = parts[0]!.toLowerCase();
      parts[1] = parts[1]!.replace(/\.git$/, "").toLowerCase();
      url.pathname = `/${parts.join("/")}`;
    }
  }
  return url.href;
}

export function githubProject(value: string): string | undefined {
  try {
    const url = new URL(canonicalSourceUrl(value));
    if (url.hostname !== "github.com") return;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2 || ["topics", "search", "settings", "marketplace", "orgs"].includes(parts[0]!)) return;
    return `${parts[0]}/${parts[1]}`;
  } catch { return; }
}

export function projectKey(urls: string[]): string {
  for (const url of urls) {
    const repo = githubProject(url);
    if (repo) return `github:${repo}`;
  }
  for (const value of urls) {
    try { return `source:${canonicalSourceUrl(value)}`; } catch { /* Skip inaccessible identities. */ }
  }
  throw new Error("missing_project_identity");
}

export function normalizePost(raw: unknown): DiscoveredPost | undefined {
  if (!raw || typeof raw !== "object") return;
  const record = raw as Record<string, any>;
  const legacy = record.legacy ?? record;
  const id = String(record.rest_id ?? legacy.id_str ?? record.id ?? "");
  if (!/^\d{8,25}$/.test(id)) return;
  const text = String(legacy.full_text ?? record.full_text ?? record.text ?? "").trim().slice(0, 20_000);
  if (!text) return;
  const user = record.core?.user_results?.result ?? record.user ?? record.author;
  const handle = user?.legacy?.screen_name ?? user?.screen_name ?? (typeof user === "string" ? user : undefined);
  const author = typeof handle === "string" && /^[\w]{1,30}$/.test(handle) ? handle : undefined;
  let url: string;
  try { url = canonicalSourceUrl(String(record.url ?? `https://x.com/${author ?? "i"}/status/${id}`)); } catch { return; }
  const created = legacy.created_at ?? record.created_at ?? record.posted_at;
  const date = typeof created === "string" ? new Date(created) : undefined;
  const publishedAt = date && Number.isFinite(date.valueOf()) ? date.toISOString() : undefined;
  const links = [...(legacy.entities?.urls ?? []), ...(record.entities?.urls ?? [])]
    .map((link: any) => link.expanded_url ?? link.unwound_url ?? link.url)
    .filter((link: unknown): link is string => typeof link === "string" && link.startsWith("https://"));
  for (const match of text.matchAll(/https:\/\/[^\s<>"']+/g)) links.push(match[0].replace(/[),.;]+$/, ""));
  return { id, url, text, author, publishedAt, links: [...new Set(links)].slice(0, 24) };
}

export function existingIdentityIndex(examples: Array<{ id: string; sources: Array<{ url: string }> }>) {
  const sources = new Map<string, string>();
  const projects = new Map<string, Set<string>>();
  for (const example of examples) for (const source of example.sources) {
    try {
      sources.set(canonicalSourceUrl(source.url), example.id);
      const repo = githubProject(source.url);
      if (repo) {
        const key = `github:${repo}`;
        const targets = projects.get(key) ?? new Set<string>();
        targets.add(example.id);
        projects.set(key, targets);
      }
    } catch { /* Invalid archived URLs never authorize a fetch. */ }
  }
  return { sources, projects };
}

export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
