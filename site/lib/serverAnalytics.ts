import { createHash } from "node:crypto";
import { getGoogleAnalyticsMeasurementId } from "./googleAnalytics";

// First-party server-side analytics. Browser pageviews come from posthog-js
// (instrumentation-client.ts) and gtag (components/GoogleAnalytics.tsx); this
// module covers traffic that never runs our JS: MCP servers reporting tool
// calls, agents fetching /llms.txt and friends, and direct /api/* callers.
//
// Event shape is the Portfolio Brain "canonical_production_server" contract:
// no $host, site_id = hackshop.dev, origin = server, deployment_environment.
// Never send idea text, device inventories, or other free-form user input.

export const SITE_ID = "hackshop.dev";
const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com";
const SEND_TIMEOUT_MS = 2_000;

export type ServerEventProperties = Record<
  string,
  string | number | boolean | null | undefined
>;

export type ServerEvent = {
  event: string;
  distinctId: string;
  properties?: ServerEventProperties;
};

function posthogToken(): string | undefined {
  return (
    process.env.POSTHOG_PROJECT_TOKEN?.trim() ||
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim() ||
    undefined
  );
}

function posthogHost(): string {
  const configured = process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim();
  // A relative host (reverse-proxy path like "/ingest") only works in the
  // browser; server captures go straight to PostHog ingestion.
  if (configured && /^https?:\/\//.test(configured)) {
    return configured.replace(/\/+$/, "");
  }
  return DEFAULT_POSTHOG_HOST;
}

export function deploymentEnvironment(): string {
  return process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development";
}

function cleanProperties(
  properties: ServerEventProperties | undefined,
): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(properties ?? {})) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

export function buildPosthogPayload(
  token: string,
  { event, distinctId, properties }: ServerEvent,
  now: Date = new Date(),
) {
  return {
    api_key: token,
    event,
    distinct_id: distinctId,
    timestamp: now.toISOString(),
    properties: {
      ...cleanProperties(properties),
      site_id: SITE_ID,
      site_name: "Hackshop",
      origin: "server",
      deployment_environment: deploymentEnvironment(),
      // Server captures arrive from Vercel's egress IP; GeoIP would be noise.
      $geoip_disable: true,
      $lib: "hackshop-server",
    },
  };
}

async function sendPosthog(event: ServerEvent): Promise<void> {
  const token = posthogToken();
  if (!token) return;
  await fetch(`${posthogHost()}/i/v0/e/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildPosthogPayload(token, event)),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });
}

// GA4 Measurement Protocol mirror. Opt-in: needs an API secret created under
// GA4 Admin > Data streams > Measurement Protocol API secrets.
async function sendGoogleAnalytics(event: ServerEvent): Promise<void> {
  const apiSecret = process.env.GA_MEASUREMENT_PROTOCOL_API_SECRET?.trim();
  if (!apiSecret) return;
  const measurementId = getGoogleAnalyticsMeasurementId(
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
  );
  const params = new URLSearchParams({
    measurement_id: measurementId,
    api_secret: apiSecret,
  });
  await fetch(`https://www.google-analytics.com/mp/collect?${params}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: event.distinctId,
      non_personalized_ads: true,
      events: [
        {
          name: event.event,
          params: {
            ...cleanProperties(event.properties),
            origin: "server",
            engagement_time_msec: 1,
          },
        },
      ],
    }),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });
}

/** Fire-and-forget; analytics must never fail or slow a request. */
export async function captureServerEvent(event: ServerEvent): Promise<void> {
  await Promise.allSettled([sendPosthog(event), sendGoogleAnalytics(event)]);
}

/**
 * Anonymous per-visitor id for requests that carry no analytics id of their
 * own. Salted with the UTC day so it cannot be joined across days, and the raw
 * IP never leaves this process.
 */
export function anonymousRequestId(req: Request, now: Date = new Date()): string {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  const ua = req.headers.get("user-agent") ?? "";
  const day = now.toISOString().slice(0, 10);
  const digest = createHash("sha256")
    .update(`${day}|${ip}|${ua}`)
    .digest("hex")
    .slice(0, 32);
  return `anon_${digest}`;
}

const AGENT_PATTERNS: ReadonlyArray<[RegExp, string]> = [
  [/claudebot|claude-user|claude-searchbot|anthropic/i, "anthropic"],
  [/gptbot|chatgpt-user|oai-searchbot|openai/i, "openai"],
  [/perplexity/i, "perplexity"],
  [/google-extended|googleother|googlebot/i, "google"],
  [/bingbot|bingpreview/i, "bing"],
  [/applebot/i, "apple"],
  [/meta-externalagent|facebookexternalhit/i, "meta"],
  [/bytespider/i, "bytedance"],
  [/ccbot/i, "commoncrawl"],
  [/cursor/i, "cursor"],
  [/python-requests|httpx|aiohttp|node-fetch|undici|axios|curl|wget|go-http-client/i, "script"],
];

/** Coarse client family from the user agent; the raw UA is not stored. */
export function classifyUserAgent(userAgent: string | null): string {
  if (!userAgent) return "unknown";
  for (const [pattern, family] of AGENT_PATTERNS) {
    if (pattern.test(userAgent)) return family;
  }
  return /mozilla\//i.test(userAgent) ? "browser" : "other";
}

/** Same-origin fetches from our own pages vs. direct API callers. */
export function requestCallerKind(req: Request): "site" | "direct" {
  const site = req.headers.get("sec-fetch-site");
  if (site === "same-origin") return "site";
  const origin = req.headers.get("origin");
  if (origin && /^https:\/\/(www\.)?hackshop\.dev$/.test(origin)) return "site";
  return "direct";
}
