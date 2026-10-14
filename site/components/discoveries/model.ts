import { DiscoveryDraft, EditRequest, type DiscoveryCandidate } from "@/lib/discoveries/types";
import type { ReverseEngineeringExample } from "@/lib/core/reverse-engineering";
import type { DiscoveryClaimResolution } from "./api";

export type EvidenceResolutionSelection = DiscoveryClaimResolution & { resolved: boolean };

export function parseEvidenceResolutions(candidate: DiscoveryCandidate, draft: ReverseEngineeringExample, selections: EvidenceResolutionSelection[]) {
  const selected = selections.filter((selection) => selection.resolved);
  if (selected.length > 10) return { success: false as const, error: "Resolve at most ten claims per save. Save those decisions, then review the remaining claims." };
  const seen = new Set<string>();
  const resolutions: DiscoveryClaimResolution[] = [];
  for (const selection of selected) {
    if (!candidate.unresolved_claims.includes(selection.claim) || seen.has(selection.claim)) return { success: false as const, error: "Each decision must refer to a unique, current unresolved claim. Reload if the claim changed." };
    if (!draft.sources.some((source) => source.url === selection.source_url)) return { success: false as const, error: "Choose a cited source from the draft being saved. A removed or queue-only source cannot resolve a claim." };
    const note = selection.note.trim();
    if (note.length < 20 || note.length > 600) return { success: false as const, error: "Each selected claim needs a reviewer explanation between 20 and 600 characters." };
    seen.add(selection.claim);
    resolutions.push({ claim: selection.claim, source_url: selection.source_url, note });
  }
  const checked = EditRequest.safeParse({ version: candidate.draft_version, hash: candidate.draft_hash, draft, resolved_claims: resolutions });
  if (!checked.success) return { success: false as const, error: "Evidence decisions must match the draft and fit the 8 KB save limit. Save fewer selected decisions at a time, or shorten their explanations." };
  return { success: true as const, resolutions: checked.data.resolved_claims ?? [] };
}

export function canApproveDiscovery(candidate: DiscoveryCandidate): boolean {
  return candidate.research_status === "ready_for_review"
    && candidate.publication_status === "unreviewed"
    && candidate.draft !== null && candidate.draft_hash !== null
    && candidate.unresolved_claims.length === 0;
}

export function providerStatusLabel(value: string): string {
  const labels: Record<string, string> = {
    no_results: "No results", completed_no_results: "No new results",
    unavailable: "Unavailable", unconfigured: "Not configured", blocked_config: "Not configured",
    pending_grok: "Waiting for GrokBot", awaiting_grok: "Waiting for GrokBot", accepted: "Request accepted; result pending",
    pending: "Pending", running: "Running", completed: "Completed", succeeded: "Completed",
    partial: "Partial coverage", failed: "Failed", retryable_failed: "Failed; can retry",
    budget_failed: "Budget limit reached", budget_blocked: "Budget limit reached", blocked_budget: "Budget limit reached",
    budget_exhausted: "Budget exhausted", no_credits: "No provider credits remaining",
    unavailable_missing_credentials: "Unavailable; credentials missing",
    unavailable_cursor_bridge: "Unavailable; upstream access unverified",
    receipt_retained_no_resend: "Existing request retained; result pending",
    sending: "Request is being sent", send_unknown: "Request delivery unconfirmed",
    skipped: "Skipped", not_run: "Not run", empty: "No results", received: "Result received",
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

export function researchStatusLabel(value: string): string {
  const labels: Record<string, string> = {
    discovered: "New lead", hydrated: "Sources collected", researching: "Research in progress",
    ready_for_review: "Ready to review", needs_evidence: "Needs evidence", retryable_failed: "Research failed",
    duplicate: "Duplicate", rejected: "Rejected",
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

export function publicationStatusLabel(value: string): string {
  const labels: Record<string, string> = {
    unreviewed: "Unreviewed", approved: "Approved; data PR pending", pr_open: "Data PR open",
    merged: "Merged; deployment pending", site_live: "Live verification passed", verification_failed: "Live verification failed",
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

export function safeSourceHref(value: string): string | null {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? value : null;
  } catch { return null; }
}

export function formatDiscoveryTime(value: string | null | undefined): string {
  if (!value || !Number.isFinite(Date.parse(value))) return "Time not recorded";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export function aiExecutionEvidence(candidate: DiscoveryCandidate): string[] {
  const texts = [candidate.research_notes, candidate.draft?.summary, candidate.draft?.outcome,
    ...(candidate.draft?.design_ideas ?? []).filter((idea) => idea.use_case === "ai_interface").map((idea) => idea.description)];
  const matching = texts.filter((text): text is string => Boolean(text))
    .flatMap((text) => text.split(/(?<=[.!?])\s+/))
    .filter((sentence) => /\b(ai|assistant|inference|language model)\b/i.test(sentence)
      && /\b(host|remote|server|cloud|backend|on-device|runs? on|local inference)\b/i.test(sentence));
  return [...new Set(matching)].slice(0, 4);
}

export function discoveryErrorText(code: string, detail?: string): string {
  const errors: Record<string, string> = {
    stale_draft: "This draft changed after you loaded it. Reload the queue before editing or reviewing it.",
    queue_unavailable: "The private queue is unavailable. No candidate count or research result could be checked.",
    auth_unavailable: "Reviewer access is not configured or could not be checked.",
    reviewer_access_unconfigured: "Reviewer access is not configured or could not be checked.",
    sign_in_required: "Sign in to open the private discovery queue.",
    reviewer_required: "Your account is signed in but does not have reviewer access.",
    invalid_response: "The queue returned an unreadable response. Reload before reviewing.",
    invalid_input: "Check the submitted URL or draft and try again.",
    invalid_resolution: "An evidence decision could not be validated. Check the current claim, its cited source in the saved draft and the 20–600-character explanation. Your decisions were not confirmed saved.",
    not_reviewable: "This candidate is no longer eligible for that review action. Reload the queue to inspect its current state.",
    already_published: "This candidate is already published. Reload the queue to inspect its publication state.",
    publication_conflict: "The publication state changed. Reload the queue before reviewing.",
    not_found: "This candidate could not be found. Reload the queue.",
    same_origin_required: "This request was blocked because it did not come from this site. Reload the page and try again.",
    body_too_large: "The draft is too large to save. Reduce its size and try again.",
    invalid_json: "The draft could not be read as JSON. Check its syntax and try again.",
  };
  return errors[code] ?? detail ?? "The request could not complete. Your changes were not confirmed saved.";
}

export function parseDiscoveryDraftJson(value: string) {
  let parsed: unknown;
  try { parsed = JSON.parse(value); }
  catch { return { success: false as const, error: "The draft is not valid JSON. Fix its syntax before saving." }; }
  const result = DiscoveryDraft.safeParse(parsed);
  if (!result.success) return { success: false as const,
    error: result.error.issues.map((issue) => `${issue.path.join(".") || "draft"}: ${issue.message}`).join("; ") };
  return { success: true as const, draft: result.data };
}
