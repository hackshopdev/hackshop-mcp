import { DiscoveryCandidateSchema, DiscoveryInboxSchema, type DiscoveryCandidate, type DiscoveryInbox, type DiscoveryClaimResolution } from "@/lib/discoveries/types";
import type { ReverseEngineeringExample } from "@/lib/core/reverse-engineering";

export type DiscoveryReviewAction = "approve" | "reject" | "needs_research";
export type { DiscoveryClaimResolution } from "@/lib/discoveries/types";
type Requester = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export class DiscoveryApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message?: string) {
    super(message ?? code);
    this.name = "DiscoveryApiError";
  }
}

async function requestJson<T>(path: string, options: RequestInit, request: Requester): Promise<T> {
  const response = await request(path, {
    ...options,
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  let body: unknown;
  try { body = await response.json(); }
  catch { throw new DiscoveryApiError(response.status, "invalid_response", "The queue returned an unreadable response."); }
  if (!response.ok) {
    const error = body && typeof body === "object" ? body as { error?: unknown; message?: unknown } : {};
    throw new DiscoveryApiError(response.status,
      typeof error.error === "string" ? error.error : "request_failed",
      typeof error.message === "string" ? error.message : undefined);
  }
  return body as T;
}

export async function loadDiscoveryInbox(request: Requester = fetch): Promise<DiscoveryInbox> {
  const body = await requestJson<unknown>("/api/admin/discoveries", { method: "GET" }, request);
  const inbox = DiscoveryInboxSchema.safeParse(body);
  if (!inbox.success) {
    throw new DiscoveryApiError(502, "invalid_response", "The queue did not return a live inbox.");
  }
  return inbox.data;
}

function readCandidate(body: { candidate: unknown }): DiscoveryCandidate {
  const parsed = DiscoveryCandidateSchema.safeParse(body?.candidate);
  if (!parsed.success) throw new DiscoveryApiError(502, "invalid_response", "The saved candidate could not be verified.");
  return parsed.data;
}

export async function intakeDiscovery(url: string, request: Requester = fetch): Promise<DiscoveryCandidate> {
  const result = await requestJson<{ candidate: DiscoveryCandidate }>("/api/admin/discoveries", {
    method: "POST", body: JSON.stringify({ url: url.trim() }),
  }, request);
  return readCandidate(result);
}

export async function saveDiscoveryDraft(
  candidate: DiscoveryCandidate,
  draft: ReverseEngineeringExample,
  request: Requester = fetch,
  resolvedClaims?: DiscoveryClaimResolution[],
): Promise<DiscoveryCandidate> {
  const result = await requestJson<{ candidate: DiscoveryCandidate }>(`/api/admin/discoveries/${encodeURIComponent(candidate.id)}`, {
    method: "PATCH",
    body: JSON.stringify({ version: candidate.draft_version, hash: candidate.draft_hash, draft,
      ...(resolvedClaims !== undefined ? { resolved_claims: resolvedClaims } : {}) }),
  }, request);
  return readCandidate(result);
}

export async function reviewDiscovery(
  candidate: DiscoveryCandidate,
  action: DiscoveryReviewAction,
  reason?: string,
  request: Requester = fetch,
): Promise<DiscoveryCandidate> {
  const result = await requestJson<{ candidate: DiscoveryCandidate }>(`/api/admin/discoveries/${encodeURIComponent(candidate.id)}/review`, {
    method: "POST",
    body: JSON.stringify({ action, version: candidate.draft_version, hash: candidate.draft_hash,
      ...(reason?.trim() ? { reason: reason.trim() } : {}) }),
  }, request);
  return readCandidate(result);
}
