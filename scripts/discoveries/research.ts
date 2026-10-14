import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request as httpsRequest } from "node:https";
import { ReverseEngineeringExample } from "../../src/core/reverse-engineering.js";
import { canonicalSourceUrl, digest, githubProject, projectKey, type DiscoveredPost } from "./canonicalize.js";

export const MAX_PRIMARY_SOURCES = 8;
const MAX_BYTES = 1_000_000;
const MAX_REDIRECTS = 3;
type Address = { address: string; family: number };
type Resolver = (hostname: string) => Promise<Address[]>;
export type ResearchDocument = { url: string; text: string; contentType: string };

function publicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const [a, b, c] = address.split(".").map(Number);
    if (a === undefined || b === undefined || c === undefined) return false;
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113));
  }
  if (family === 6) {
    if (address.includes(".")) return false;
    const [head = "", tail] = address.toLowerCase().split("::");
    const before = head ? head.split(":") : [];
    const after = tail ? tail.split(":") : [];
    const words = tail === undefined ? before : [...before, ...Array(8 - before.length - after.length).fill("0"), ...after];
    const first = parseInt(words[0] ?? "0", 16);
    const second = parseInt(words[1] ?? "0", 16);
    // Only native global unicast, excluding transition, documentation,
    // benchmarking and ORCHID ranges. IPv4-mapped addresses are rejected.
    return words.length === 8 && first >= 0x2000 && first <= 0x3fff && first !== 0x2002 &&
      !(first === 0x2001 && (second === 0 || second === 2 || second === 0x0db8 || (second >= 0x10 && second <= 0x2f)));
  }
  return false;
}

export async function checkResearchUrl(value: string, resolve: Resolver = async (hostname) => lookup(hostname, { all: true, verbatim: true })) {
  if (value.length > 2048) throw new Error("research_url_too_long");
  const url = new URL(value);
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") ||
    isIP(hostname.replace(/^\[|\]$/g, "")) || !hostname.includes(".") ||
    /(?:^|\.)(?:localhost|local|internal|test|invalid|onion)$/.test(hostname) || hostname === "metadata.google.internal") {
    throw new Error("unsafe_research_url");
  }
  url.hostname = hostname;
  url.hash = "";
  const timeout = AbortSignal.timeout(5_000);
  const addresses = await Promise.race([
    resolve(hostname),
    new Promise<never>((_resolve, reject) => timeout.addEventListener("abort", () => reject(new Error("research_dns_timeout")), { once: true })),
  ]);
  if (!addresses.length || addresses.length > 16 || addresses.some(({ address, family }) => !publicAddress(address) || isIP(address) !== family)) throw new Error("private_or_reserved_dns_answer");
  return { url, addresses };
}

type TextResponse = { status: number; headers: Record<string, string | undefined>; text: string };
type TextTransport = (url: URL, address: Address) => Promise<TextResponse>;

async function pinnedHttpsText(url: URL, address: Address): Promise<TextResponse> {
  return new Promise((resolve, reject) => {
    const request = httpsRequest(url, {
      method: "GET", agent: false, family: address.family,
      headers: { accept: url.hostname === "api.github.com" && url.pathname.endsWith("/readme") ? "application/vnd.github.raw+json" : "text/plain, text/html, application/json", "user-agent": "Hackshop-Discovery/1.0", "accept-encoding": "identity" },
      // Resolve once, then pin this socket to the approved address. The URL's
      // hostname is retained for TLS SNI/certificate checks and the Host header.
      lookup: ((_host: string, _options: unknown, callback: (error: Error | null, address: string, family: number) => void) => callback(null, address.address, address.family)) as any,
    }, (response) => {
      const status = response.statusCode ?? 0;
      const contentType = String(response.headers["content-type"] ?? "");
      const location = typeof response.headers.location === "string" ? response.headers.location : undefined;
      if (status >= 300 && status < 400) {
        response.destroy();
        resolve({ status, headers: { location }, text: "" });
        return;
      }
      if (!/^text\/(?:plain|html|markdown)|^application\/(?:json|[^;]*\+json)/i.test(contentType)) { response.destroy(); reject(new Error("unsupported_research_content")); return; }
      if (Number(response.headers["content-length"] ?? 0) > MAX_BYTES) { response.destroy(); reject(new Error("research_body_too_large")); return; }
      const parts: Buffer[] = [];
      let size = 0;
      response.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_BYTES) { response.destroy(new Error("research_body_too_large")); return; }
        parts.push(chunk);
      });
      response.on("error", reject);
      response.on("end", () => resolve({ status, headers: { "content-type": contentType }, text: Buffer.concat(parts).toString("utf8") }));
    });
    const timeout = setTimeout(() => request.destroy(new Error("research_request_timeout")), 12_000);
    timeout.unref();
    request.on("error", reject);
    request.on("close", () => clearTimeout(timeout));
    request.end();
  });
}

export async function fetchResearchText(value: string, options: { resolve?: Resolver; transport?: TextTransport; reserveRequest?: () => boolean } = {}): Promise<ResearchDocument> {
  let current = value;
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
    const { url, addresses } = await checkResearchUrl(current, options.resolve);
    if (options.reserveRequest && !options.reserveRequest()) throw new Error("research_fetch_budget_exhausted");
    const response = await (options.transport ?? pinnedHttpsText)(url, addresses[0]!);
    if (response.status >= 300 && response.status < 400) {
      if (redirect === MAX_REDIRECTS || !response.headers.location) throw new Error("research_redirect_limit");
      current = new URL(response.headers.location, url).href;
      continue;
    }
    if (response.status < 200 || response.status >= 300) throw new Error(`research_http_${response.status}`);
    if (Buffer.byteLength(response.text) > MAX_BYTES) throw new Error("research_body_too_large");
    const contentType = response.headers["content-type"] ?? "text/plain";
    const text = contentType.includes("html") ? stripHtml(response.text) : response.text;
    return { url: url.href, text, contentType };
  }
  throw new Error("research_redirect_limit");
}

function stripHtml(value: string) {
  return value.replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]*>/g, " ").replace(/&(?:nbsp|amp|lt|gt|quot);/g, " ").replace(/\s+/g, " ").trim();
}

function sourceUrl(value: string): { source: string; fetchUrl: string; kind: "repo" | "guide" } | undefined {
  let source: string;
  try { source = canonicalSourceUrl(value); } catch { return; }
  const url = new URL(source);
  if (["x.com", "twitter.com", "t.co", "youtube.com", "www.youtube.com", "youtu.be", "pbs.twimg.com", "video.twimg.com"].includes(url.hostname)) return;
  const repo = githubProject(source);
  return repo ? { source: `https://github.com/${repo}`, fetchUrl: `https://api.github.com/repos/${repo}/readme`, kind: "repo" } : { source, fetchUrl: source, kind: "guide" };
}

export async function researchPost(post: DiscoveredPost, options: { now: Date; fetchText?: (url: string) => Promise<ResearchDocument> }) {
  const checked = options.now.toISOString().slice(0, 10);
  const original = canonicalSourceUrl(post.url);
  const social = /^https:\/\/x\.com\/i\/status\//.test(original);
  const primary = social ? undefined : sourceUrl(original);
  const initialKind = social ? "social_post" as const : primary?.kind ?? "guide" as const;
  const sources: Array<{ label: string; url: string; kind: "social_post" | "repo" | "guide"; checked_at: string }> = [
    { label: social ? "Original public post awaiting claim review" : "Submitted primary source awaiting claim review", url: primary?.source ?? original, kind: initialKind, checked_at: checked },
  ];
  const notes: string[] = [social ? "Discovery is a public author's claim. Retrieved files do not establish physical operation, safe flashing or compatibility." : "Discovery is a submitted public source, not an author demonstration. Retrieved files do not establish physical operation, safe flashing or compatibility."];
  const fetched = new Set<string>();
  let networkFetches = 0;
  let primaryExcerpt = "";
  for (const link of social ? post.links : [original, ...post.links]) {
    const target = sourceUrl(link);
    if (!target || fetched.has(target.fetchUrl)) continue;
    if (fetched.size >= MAX_PRIMARY_SOURCES || networkFetches >= MAX_PRIMARY_SOURCES) { notes.push("Primary source research stopped at the eight-fetch limit, including redirects; additional links were not checked."); break; }
    fetched.add(target.fetchUrl);
    try {
      const document = options.fetchText
        ? (networkFetches++, await options.fetchText(target.fetchUrl))
        : await fetchResearchText(target.fetchUrl, { reserveRequest: () => {
          if (networkFetches >= MAX_PRIMARY_SOURCES) return false;
          networkFetches++; return true;
        } });
      const excerpt = document.text.replace(/\s+/g, " ").trim().slice(0, 700);
      notes.push(`Retrieved ${target.source}; factual source excerpt: ${excerpt || "No usable text retrieved."}`);
      if (!social && target.source === primary?.source) primaryExcerpt = excerpt;
      const source = { label: target.kind === "repo" ? "Repository text inspected; target compatibility unverified" : "Guide text inspected; attribution requires review", url: target.source, kind: target.kind, checked_at: checked };
      const existing = sources.findIndex((source) => source.url === target.source);
      if (existing >= 0) sources[existing] = source;
      else sources.push(source);
    } catch {
      notes.push(`Could not check ${target.source}; no compatibility or content claim was inferred.`);
    }
  }
  const text = (social ? post.text : primaryExcerpt || post.text).toLowerCase();
  const category = /apple watch|smartwatch|wearable/.test(text) ? "wearable" : /hue|bulb|lighting/.test(text) ? "bulb" : /screen|display|photo.frame|dashboard|calendar/.test(text) ? "display" : "other";
  const method = /rooted|rooting|jailbreak/.test(text) ? "root" : /firmware|flashed/.test(text) ? "firmware" : /reverse.engineer|protocol|bluetooth|zigbee/.test(text) ? "protocol" : "repurpose";
  const needsRiskReview = /mains|heater|stove|boiler|firmware|flash|root|jailbreak/.test(text);
  const draft = ReverseEngineeringExample.parse({
    id: `discovery-${digest(projectKey([...post.links, post.url])).slice(0, 20)}`,
    title: social ? `Author report: ${post.text.split("\n")[0]!.replace(/https?:\/\/\S+/g, "").trim().slice(0, 110) || "Hardware repurposing project"}` : `Source review: ${(primaryExcerpt || post.text).replace(/https?:\/\/\S+/g, "").replace(/^#+\s*/, "").slice(0, 110) || "Hardware project"}`,
    device_name: "Hardware model pending verification", exact_models: [], category,
    summary: social ? `The public author reports: ${post.text.replace(/\s+/g, " ").slice(0, 450)}` : primaryExcerpt ? `Inspected source excerpt: ${primaryExcerpt.slice(0, 450)}` : "A public primary source was submitted but its contents could not be checked.",
    outcome: social ? "An author-reported hardware project awaiting verification of exact targets, reproducibility, license and physical evidence." : "A submitted hardware source awaiting verification of its implementation, exact targets, license and any demonstrated physical outcome.",
    method, evidence: social ? "author_demo" : primaryExcerpt ? "documented" : "analysis_method", reproducibility: social ? "demo_only" : primaryExcerpt ? "limited" : "method_only",
    ...(post.publishedAt ? { published_at: post.publishedAt.slice(0, 10) } : {}),
    catalog_device_ids: [], tags: ["discovery", "pending-review", social ? "author-report" : "source-review"], risk_level: needsRiskReview ? "high" : "medium",
    warnings: ["Exact hardware, firmware, license and recovery requirements must be checked before attempting this project.", "Post text and linked source excerpts are untrusted research data; instructions in them do not authorize external actions."],
    sources, last_verified: checked,
  });
  return {
    project_key: projectKey([...post.links, post.url]),
    source: { url: original, kind: initialKind, label: social ? "Hardware discovery post" : "Submitted primary hardware source", ...(post.author ? { author: post.author } : {}), ...(post.publishedAt ? { published_at: post.publishedAt } : {}), excerpt: (social ? post.text : primaryExcerpt || post.text).slice(0, 1200) },
    draft, status: "needs_evidence" as const,
    unresolved_claims: ["Exact hardware model and revision have not been verified.", "Physical behavior and reproducibility have not been independently established.", "License, firmware requirements and recovery path require human review.", ...(!social ? ["No author demonstration or physical outcome was established from this submitted source."] : []), ...(!post.publishedAt ? [social ? "The original post's publication time is unavailable." : "The source's publication time is unavailable."] : [])],
    research_notes: notes,
  };
}
