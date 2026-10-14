import * as contractModule from "../../site/lib/discoveries/types.js";
import type { WorkerRequest, DiscoveryCandidate, DiscoveryRun, CreditReservation } from "../../site/lib/discoveries/types.js";
import { readBoundedJson } from "./scrapecreators.js";

export type WorkerClient = ReturnType<typeof createWorkerClient>;
const contract = ((contractModule as any).default ?? contractModule) as typeof import("../../site/lib/discoveries/types.js");
export function createWorkerClient(options: { token: string; url?: string; fetch?: typeof fetch }) {
  const url = new URL(options.url ?? "https://www.hackshop.dev/api/discovery-worker");
  if (url.protocol !== "https:" || url.hostname !== "www.hackshop.dev" || url.pathname !== "/api/discovery-worker" || url.port || url.username || url.password || url.search || url.hash) throw new Error("invalid_worker_endpoint");
  if (!options.token) throw new Error("missing_discovery_worker_token");
  async function send<T>(input: WorkerRequest): Promise<T> {
    const body = JSON.stringify(contract.WorkerRequest.parse(input));
    if (Buffer.byteLength(body) > 150_000) throw new Error("worker_request_too_large");
    const response = await (options.fetch ?? fetch)(url, { method: "POST", redirect: "error", headers: { "content-type": "application/json", authorization: `Bearer ${options.token}`, accept: "application/json" }, body, signal: AbortSignal.timeout(20_000) });
    const result = await readBoundedJson(response, 1_500_000);
    if (!response.ok) throw new Error(typeof result.error === "string" ? `worker_${result.error}` : `worker_http_${response.status}`);
    return result as T;
  }
  return {
    begin: (input: Omit<Extract<WorkerRequest, { action: "begin_run" }>, "action">) => send<{ run: DiscoveryRun; replayed: boolean }>({ action: "begin_run", ...input }),
    checkpoint: (input: Omit<Extract<WorkerRequest, { action: "checkpoint" }>, "action">) => send<{ run: DiscoveryRun }>({ action: "checkpoint", ...input }),
    ingest: (input: Omit<Extract<WorkerRequest, { action: "ingest" }>, "action">) => send<{ candidates: DiscoveryCandidate[] }>({ action: "ingest", ...input }),
    harvest: (input: Omit<Extract<WorkerRequest, { action: "ingest_grok_result" }>, "action">) => send<{ candidates: DiscoveryCandidate[]; replayed: boolean }>({ action: "ingest_grok_result", ...input }),
    finish: (input: Omit<Extract<WorkerRequest, { action: "finish_run" }>, "action">) => send<{ run: DiscoveryRun }>({ action: "finish_run", ...input }),
    reserve: (run_id: string, reservation_key: string) => send<CreditReservation>({ action: "reserve_credits", run_id, reservation_key, credits: 1 }),
    reserveGrok: (run_id: string, reservation_key: string) => send<{ allowed: boolean; replayed: boolean; reservation_key: string }>({ action: "reserve_grok", run_id, reservation_key }),
    settle: (run_id: string, reservation_key: string, charged_credits: number) => send<CreditReservation>({ action: "settle_credits", run_id, reservation_key, charged_credits }),
    pending: () => send<{ candidates: DiscoveryCandidate[]; runs: DiscoveryRun[] }>({ action: "read_pending" }),
  };
}
