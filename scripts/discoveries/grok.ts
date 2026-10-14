import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { canonicalSourceUrl, digest, type DiscoveredPost } from "./canonicalize.js";

export type GrokReceipt = {
  request_id: string;
  status: "sending" | "send_unknown" | "accepted" | "pending" | "completed" | "failed";
  accepted_at?: string;
  completed_at?: string;
  result_hash?: string;
  provider_run_id?: string;
  provider?: "xai_gateway" | "xai_webhook" | "cursor_bridge" | "grokbot_webhook";
};
export type GrokResearchResult = { posts: DiscoveredPost[]; coverage_note: string };

export type GrokCli = (args: string[], options: { input?: string; env?: Record<string, string | undefined> }) => Promise<{ stdout: string; exitCode: number }>;
export const executeGrokCli: GrokCli = (args, options) => new Promise((resolve, reject) => {
  const env: NodeJS.ProcessEnv = { PATH: process.env.PATH, HOME: process.env.HOME, PYTHONIOENCODING: "utf-8" };
  for (const key of ["GROKBOT_WEBHOOK_URL", "GROKBOT_WEBHOOK_SECRET", "GROKBOT_RELAY_URL", "GROKBOT_RELAY_READ_SECRET", "GROKBOT_CALLBACK_SECRET", "GROKBOT_CONFIG_PATH", "GROKBOT_WEBHOOK_STATE_DIR"]) {
    const value = options.env?.[key] ?? process.env[key]; if (value) env[key] = value;
  }
  const child = execFile("python3", [fileURLToPath(new URL("./grokbot_webhook.py", import.meta.url)), ...args], {
    env, timeout: 45_000, maxBuffer: 1_500_000, windowsHide: true,
  }, (error, stdout) => {
    if (error && (error.killed || typeof error.code !== "number")) reject(new Error("grok_cli_transport_unknown"));
    else resolve({ stdout, exitCode: error ? Number(error.code) : 0 });
  });
  child.stdin?.end(options.input ?? "");
});
function cliJson(stdout: string): Record<string, any> {
  if (Buffer.byteLength(stdout) > 1_500_000) throw new Error("grok_cli_output_too_large");
  let value: unknown; try { value = JSON.parse(stdout); } catch { throw new Error("grok_cli_invalid_output"); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("grok_cli_invalid_output");
  return value as Record<string, any>;
}
export async function sendGrokCliRequest(options: {
  requestId: string; task: string; now: Date; cli?: GrokCli; env?: Record<string, string | undefined>;
  reserve: () => Promise<{ allowed: boolean; replayed?: boolean }>;
  persist: (receipt: GrokReceipt) => Promise<void>;
}): Promise<GrokReceipt | { status: "unavailable" | "budget_exhausted" | "replayed"; reason?: string }> {
  assertRequestId(options.requestId);
  if (!options.task.trim() || Buffer.byteLength(options.task) > 12_000) throw new Error("invalid_grok_task");
  const cli = options.cli ?? executeGrokCli;
  let config: Record<string, any>;
  try {
    const output = await cli(["check-config", "--json"], { env: options.env });
    if (output.exitCode !== 0) throw new Error("grok_cli_config_unavailable");
    config = cliJson(output.stdout);
  }
  catch { return { status: "unavailable", reason: "grok_cli_unavailable" }; }
  if (config.configured !== true) return { status: "unavailable", reason: "grok_cli_unconfigured" };
  const reservation = await options.reserve();
  if (!reservation.allowed) return { status: "budget_exhausted" };
  if (reservation.replayed) return { status: "replayed" };
  const sending: GrokReceipt = { request_id: options.requestId, status: "sending", provider: "grokbot_webhook" };
  await options.persist(sending);
  let value: Record<string, any>;
  try {
    const output = await cli(["send", "--request-id", options.requestId, "--task-stdin", "--wait", "0", "--keep-remote", "--json"], { input: options.task, env: options.env });
    value = cliJson(output.stdout);
    if (value.request_id !== options.requestId) throw new Error("cli_request_identity_mismatch");
    const rejection = value.status === "failed" && value.error === "webhook_rejected" && Number.isInteger(value.http_status) && value.http_status >= 400 && value.http_status < 500;
    const normal = output.exitCode === 0 && ["accepted", "pending", "send_unknown"].includes(value.status);
    const retainedCompletion = output.exitCode === 0 && value.status === "completed" && value.replayed === true;
    if (!normal && !retainedCompletion && !((output.exitCode === 0 || output.exitCode === 1) && rejection)) throw new Error("cli_acknowledgement_unknown");
  } catch {
    const unknown: GrokReceipt = { ...sending, status: "send_unknown" };
    await options.persist(unknown); return unknown;
  }
  // A local retained completion still requires an authenticated remote harvest.
  const state: GrokReceipt["status"] = value.status === "completed" ? "pending" : value.status;
  const receipt: GrokReceipt = { ...sending, status: state,
    ...(state === "accepted" ? { accepted_at: options.now.toISOString() } : {}),
    ...(typeof value.provider_run_id === "string" && /^[A-Za-z0-9_-]{1,160}$/.test(value.provider_run_id) ? { provider_run_id: value.provider_run_id } : {}),
  };
  await options.persist(receipt); return receipt;
}
export async function harvestGrokCliResult(options: {
  requestId: string; cli?: GrokCli; env?: Record<string, string | undefined>;
  ingest: (result: GrokResearchResult, hash: string, status: "completed" | "failed") => Promise<void>;
  complete: (receipt: GrokReceipt) => Promise<void>;
}): Promise<{ status: "pending" | "completed" | "failed"; result?: GrokResearchResult }> {
  assertRequestId(options.requestId);
  const output = await (options.cli ?? executeGrokCli)(["status", "--request-id", options.requestId, "--remote", "--keep-remote", "--json"], { env: options.env });
  const remote = cliJson(output.stdout);
  if (remote.request_id !== options.requestId) throw new Error("cli_request_identity_mismatch");
  if (output.exitCode !== 0) throw new Error("grok_cli_status_unavailable");
  if (remote.status !== "completed" && remote.status !== "failed") return { status: "pending" };
  const hash = digest(JSON.stringify(remote.result ?? null));
  const result = remote.status === "completed" ? parseGrokResearch(remote.result) : { posts: [], coverage_note: "GrokBot reported a failed research request." };
  result.coverage_note = (result.coverage_note + " GrokBot was called through the CLI webhook; its upstream Grok access is not independently verified.").slice(0, 2000);
  await options.ingest(result, hash, remote.status);
  await options.complete({ request_id: options.requestId, status: remote.status, result_hash: hash, completed_at: new Date().toISOString(), provider: "grokbot_webhook" });
  return { status: remote.status, result };
}

function assertRequestId(value: string) {
  if (!/^[A-Za-z0-9_-]{8,120}$/.test(value)) throw new Error("invalid_grok_request_id");
}

export function parseGrokResearch(value: unknown): GrokResearchResult {
  let decoded: any = value;
  if (typeof decoded === "string") {
    try { decoded = JSON.parse(decoded.replace(/^```(?:json)?\s*|\s*```$/g, "")); }
    catch { decoded = { posts: [...decoded.matchAll(/https:\/\/(?:x\.com|twitter\.com)\/[^\s<>"']+\/status\/\d{8,25}/g)].map((match: RegExpMatchArray) => ({ url: match[0], note: "Grok returned this public post URL; the post and its claims still require hydration." })) }; }
  }
  const posts: DiscoveredPost[] = [];
  for (const raw of Array.isArray(decoded?.posts) ? decoded.posts.slice(0, 20) : []) {
    try {
      const url = canonicalSourceUrl(raw.url);
      if (!url.startsWith("https://x.com/i/status/")) continue;
      const date = typeof raw.posted_at === "string" ? new Date(raw.posted_at) : undefined;
      posts.push({ id: url.split("/").at(-1)!, url, text: String(raw.note ?? raw.text ?? raw.relevance ?? "Public hardware project claim awaiting verification.").slice(0, 2000), author: typeof raw.author === "string" ? raw.author.slice(0, 80) : undefined, publishedAt: date && Number.isFinite(date.valueOf()) ? date.toISOString() : undefined, links: Array.isArray(raw.primary_urls) ? raw.primary_urls.filter((link: unknown): link is string => typeof link === "string" && link.startsWith("https://")).slice(0, 8) : [] });
    } catch { /* Invalid or private URLs cannot enter discovery. */ }
  }
  return { posts, coverage_note: String(decoded?.coverage_note ?? decoded?.scope ?? "Grok returned public-post suggestions. Search scope and completeness were not independently established.").slice(0, 2000) };
}
