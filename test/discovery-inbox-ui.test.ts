import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "../site/node_modules/react";
import { renderToStaticMarkup } from "../site/node_modules/react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { DiscoveryCandidate, DiscoveryInbox } from "../site/lib/discoveries/types";

let api: typeof import("../site/components/discoveries/api") | null = null;
let model: typeof import("../site/components/discoveries/model") | null = null;
let details: typeof import("../site/components/discoveries/DiscoveryDetails") | null = null;

beforeAll(async () => {
  if (existsSync(resolve("site/components/discoveries/api.ts"))) api = await import("../site/components/discoveries/api");
  if (existsSync(resolve("site/components/discoveries/model.ts"))) model = await import("../site/components/discoveries/model");
  if (existsSync(resolve("site/components/discoveries/DiscoveryDetails.tsx"))) details = await import("../site/components/discoveries/DiscoveryDetails");
});

function requiredApi() { expect(api, "Inbox API client must exist").not.toBeNull(); return api!; }
function requiredModel() { expect(model, "Inbox state presentation must exist").not.toBeNull(); return model!; }
function requiredDetails() { expect(details, "Candidate review pane must exist").not.toBeNull(); return details!; }

function candidate(overrides: Partial<DiscoveryCandidate> = {}): DiscoveryCandidate {
  return {
    id: "c43cce37-692f-419d-a14f-7c9f6f0bd094",
    project_key: "https://github.com/example/clock",
    proposal_kind: "new", target_example_id: null,
    research_status: "ready_for_review",
    publication_status: "unreviewed",
    draft_version: 7,
    draft_hash: "a".repeat(64),
    draft: {
      id: "review-clock", title: "A reclaimed calendar clock", device_name: "Clock model A",
      category: "display", exact_models: ["Model A / PCB 2", "Firmware 1.2"],
      summary: "A documented calendar interface.", outcome: "Displays a schedule.",
      method: "repurpose", evidence: "documented", reproducibility: "repeatable",
      catalog_device_ids: [], tags: ["calendar"], risk_level: "medium",
      warnings: ["Back up the original firmware."],
      sources: [{ label: "Project guide", url: "https://github.com/example/clock", kind: "repo", checked_at: "2026-10-14" }],
      last_verified: "2026-10-14",
    },
    sources: [{ url: "https://github.com/example/clock", label: "Project guide", kind: "repo", author: "Author",
      published_at: "2026-10-14", excerpt: "Tested on PCB 2.", checked_at: "2026-10-14" }],
    unresolved_claims: [], research_notes: "The AI runs on a remote server; the clock displays its replies.",
    approved_at: null, approved_hash: null, approved_version: null, base_record_hash: null, pr_url: null,
    created_at: "2026-10-14T12:00:00Z", updated_at: "2026-10-14T12:10:00Z",
    ...overrides,
  };
}

function inbox(): DiscoveryInbox {
  return { candidates: [], runs: [], stats: { total: 0, needs_review: 0, needs_evidence: 0, approved: 0, published: 0 }, source: "live" };
}

describe("private discovery inbox request safety", () => {
  it("binds review to the displayed version and hash and preserves the explicit action", async () => {
    const client = requiredApi();
    const item = candidate();
    const request = vi.fn(async () => Response.json({ candidate: item }));
    await client.reviewDiscovery(item, "approve", " Source checked ", request);
    expect(request).toHaveBeenCalledTimes(1);
    const [url, options] = request.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`/api/admin/discoveries/${item.id}/review`);
    expect(options.credentials).toBe("same-origin");
    expect(JSON.parse(String(options.body))).toEqual({ action: "approve", version: 7, hash: item.draft_hash, reason: "Source checked" });
  });

  it("surfaces stale draft conflicts without retrying or replacing the submitted hash", async () => {
    const client = requiredApi();
    const request = vi.fn(async () => Response.json({ error: "stale_draft" }, { status: 409 }));
    await expect(client.reviewDiscovery(candidate(), "reject", "Needs a matching model", request))
      .rejects.toMatchObject({ status: 409, code: "stale_draft" });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("reports an unavailable queue as an error, not an empty successful inbox", async () => {
    const client = requiredApi();
    await expect(client.loadDiscoveryInbox(async () => Response.json({ error: "queue_unavailable" }, { status: 503 })))
      .rejects.toMatchObject({ status: 503, code: "queue_unavailable" });
    expect(await client.loadDiscoveryInbox(async () => Response.json(inbox()))).toEqual(inbox());
  });

  it("submits manual URL intake without inventing a researched draft", async () => {
    const client = requiredApi();
    const item = candidate({ draft: null, draft_hash: null, draft_version: 1, research_status: "discovered" });
    const request = vi.fn(async () => Response.json({ candidate: item }));
    expect(await client.intakeDiscovery(" https://x.com/example/status/123 ", request)).toEqual(item);
    const [, options] = request.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(options.body))).toEqual({ url: "https://x.com/example/status/123" });
  });

  it("saves the edited draft against the same displayed snapshot", async () => {
    const client = requiredApi();
    const item = candidate();
    const draft = { ...item.draft!, title: "Edited calendar clock" };
    const request = vi.fn(async () => Response.json({ candidate: { ...item, draft, draft_version: 8 } }));
    await client.saveDiscoveryDraft(item, draft, request);
    const [, options] = request.mock.calls[0] as unknown as [string, RequestInit];
    expect(options.method).toBe("PATCH");
    expect(JSON.parse(String(options.body))).toEqual({ version: 7, hash: item.draft_hash, draft });
  });

  it("sends only explicit cited resolutions with the saved draft and displayed CAS", async () => {
    const client = requiredApi();
    const item = candidate({ research_status: "needs_evidence", unresolved_claims: ["Exact hardware unknown", "Price source missing"] });
    const resolutions = [{ claim: "Exact hardware unknown", source_url: item.draft!.sources[0].url,
      note: "The guide does not establish the exact board; the draft retains that limitation." }];
    const request = vi.fn(async () => Response.json({ candidate: item }));
    await client.saveDiscoveryDraft(item, item.draft!, request, resolutions);
    const [, options] = request.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(options.body));
    expect(body).toEqual({ version: 7, hash: item.draft_hash, draft: item.draft, resolved_claims: resolutions });
    expect(body).not.toHaveProperty("unresolved_claims");
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("preserves backend invalid-resolution errors without retrying or clearing claims", async () => {
    const client = requiredApi();
    const request = vi.fn(async () => Response.json({ error: "invalid_resolution" }, { status: 422 }));
    await expect(client.saveDiscoveryDraft(candidate(), candidate().draft!, request,
      [{ claim: "Changed claim", source_url: "https://example.com/unmatched", note: "This is an explicit explanation." }]))
      .rejects.toMatchObject({ status: 422, code: "invalid_resolution" });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed live responses instead of rendering unchecked approval candidates", async () => {
    const client = requiredApi();
    await expect(client.loadDiscoveryInbox(async () => Response.json({ ...inbox(), candidates: [{ id: "missing-fields" }] })))
      .rejects.toMatchObject({ code: "invalid_response" });
  });
});

describe("honest discovery review presentation", () => {
  it("allows approval only for a complete, unreviewed, ready snapshot", () => {
    const presentation = requiredModel();
    expect(presentation.canApproveDiscovery(candidate())).toBe(true);
    for (const item of [candidate({ unresolved_claims: ["Exact hardware unknown"] }),
      candidate({ draft: null }), candidate({ draft_hash: null }), candidate({ research_status: "needs_evidence" }),
      candidate({ publication_status: "pr_open" })]) {
      expect(presentation.canApproveDiscovery(item)).toBe(false);
    }
  });

  it("keeps no results, unavailable, pending Grok and budget failure distinct", () => {
    const presentation = requiredModel();
    const labels = ["no_results", "unavailable", "pending_grok", "budget_failed"].map(presentation.providerStatusLabel);
    expect(new Set(labels).size).toBe(4);
    expect(labels.join(" ")).toMatch(/No results/);
    expect(labels.join(" ")).toMatch(/Unavailable/);
    expect(labels.join(" ")).toMatch(/Waiting for GrokBot/);
    expect(labels.join(" ")).toMatch(/Budget/);
  });

  it("does not infer the upstream model from a bridge hostname", () => {
    expect(requiredModel().providerStatusLabel("unavailable_cursor_bridge")).toBe("Unavailable; upstream access unverified");
  });

  it("rejects unsafe source-link schemes", () => {
    const presentation = requiredModel();
    expect(presentation.safeSourceHref("https://github.com/example/clock")).toBe("https://github.com/example/clock");
    expect(presentation.safeSourceHref("javascript:alert(1)")).toBeNull();
    expect(presentation.safeSourceHref("https://user:password@example.com/secret")).toBeNull();
  });

  it("presents the actual backend budget and unconfigured-reviewer states plainly", () => {
    const presentation = requiredModel();
    expect(presentation.providerStatusLabel("budget_exhausted")).toBe("Budget exhausted");
    expect(presentation.discoveryErrorText("reviewer_access_unconfigured")).toMatch(/not configured/);
    expect(presentation.discoveryErrorText("not_reviewable")).toMatch(/no longer eligible/);
  });

  it("validates strict draft JSON and rejects unknown fields before a save", () => {
    const presentation = requiredModel();
    expect(presentation.parseDiscoveryDraftJson).toBeTypeOf("function");
    expect(presentation.parseDiscoveryDraftJson(JSON.stringify(candidate().draft)).success).toBe(true);
    expect(presentation.parseDiscoveryDraftJson("{").success).toBe(false);
    expect(presentation.parseDiscoveryDraftJson(JSON.stringify({ ...candidate().draft, private_token: "bad" })).success).toBe(false);
  });

  it("shows exact targets, evidence, cost gaps and AI execution without a physical proof claim", () => {
    const view = requiredDetails();
    const html = renderToStaticMarkup(createElement(view.DiscoveryDetails, {
      candidate: candidate(), busy: false, stale: false,
      onReview: () => {}, onSave: () => {},
    }));
    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    expect(text).toContain("Model A / PCB 2");
    expect(text).toContain("Firmware 1.2");
    expect(text).toContain("Cost not established");
    expect(text).toContain("AI runs on a remote server");
    expect(text).toContain("Back up the original firmware.");
    expect(text).toContain("Approve for library");
    expect(text).toContain("data PR");
    expect(text).not.toMatch(/physical prototype|validated build/i);
  });

  it("disables approval for missing evidence and keeps unresolved claims visible", () => {
    const view = requiredDetails();
    const html = renderToStaticMarkup(createElement(view.DiscoveryDetails, {
      candidate: candidate({ unresolved_claims: ["Price source missing"] }), busy: false, stale: false,
      onReview: () => {}, onSave: () => {},
    }));
    expect(html).toContain("Price source missing");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Approve for library/);
  });

  it("keeps stale review controls disabled and the draft inspection keyboard reachable", () => {
    const view = requiredDetails();
    const html = renderToStaticMarkup(createElement(view.DiscoveryDetails, {
      candidate: candidate(), busy: false, stale: true, onReview: () => {}, onSave: () => {},
    }));
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Approve for library/);
    expect(html).toMatch(/<pre[^>]*tabindex="0"/);
    expect(html).toMatch(/<textarea[^>]*id="discovery-review-reason"[^>]*maxLength="600"/i);
    expect(html).toContain("Reload the queue");
  });

  it("renders labelled per-claim citation, explanation and unchecked resolution controls", () => {
    const view = requiredDetails();
    const html = renderToStaticMarkup(createElement(view.DiscoveryDetails, {
      candidate: candidate({ research_status: "needs_evidence", unresolved_claims: ["Exact hardware unknown", "Price source missing"],
        sources: [...candidate().sources, { ...candidate().sources[0], url: "https://example.com/queue-only", label: "Queue-only lead" }] }),
      busy: false, stale: false, onReview: () => {}, onSave: () => {},
    }));
    expect(html.match(/<fieldset/g)).toHaveLength(2);
    expect(html).toContain("Cited source");
    expect(html).toContain("Reviewer explanation");
    expect(html).toContain("Resolve this claim when saved");
    expect(html).toContain("Save evidence decisions");
    expect(html).toMatch(/<textarea[^>]*minLength="20"[^>]*maxLength="600"/i);
    expect(html.match(/<input[^>]*type="checkbox"/g)).toHaveLength(2);
    expect(html).not.toMatch(/<input[^>]*type="checkbox"[^>]*checked/);
    expect(html).not.toMatch(/<option[^>]*value="https:\/\/example.com\/queue-only"/);
    expect(html).toContain("Unknowns may remain");
  });

  it("keeps stale evidence-resolution controls disabled", () => {
    const view = requiredDetails();
    const html = renderToStaticMarkup(createElement(view.DiscoveryDetails, {
      candidate: candidate({ unresolved_claims: ["Price source missing"] }), busy: false, stale: true,
      onReview: () => {}, onSave: () => {},
    }));
    expect(html).toMatch(/<fieldset[^>]*disabled=""/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Save evidence decisions/);
  });

  it("does not resolve unchecked claims and validates exact citations and explanations", () => {
    const presentation = requiredModel();
    const item = candidate({ unresolved_claims: ["Exact hardware unknown", "Price source missing"] });
    const selected = { claim: "Exact hardware unknown", source_url: item.draft!.sources[0].url,
      note: "The source is limited to PCB 2; compatibility remains unverified elsewhere.", resolved: true };
    const parse = presentation.parseEvidenceResolutions;
    expect(parse).toBeTypeOf("function");
    expect(parse(item, item.draft!, [{ ...selected, resolved: false }])).toEqual({ success: true, resolutions: [] });
    expect(parse(item, item.draft!, [selected])).toEqual({ success: true, resolutions: [{ claim: selected.claim, source_url: selected.source_url, note: selected.note }] });
    for (const invalid of [{ ...selected, claim: "Not a current claim" }, { ...selected, source_url: "https://example.com/unmatched" },
      { ...selected, note: "Too brief" }, { ...selected, note: "x".repeat(601) }]) {
      expect(parse(item, item.draft!, [invalid]).success).toBe(false);
    }
    expect(parse(item, { ...item.draft!, sources: [{ ...item.draft!.sources[0], url: "https://example.com/replaced" }] }, [selected]).success).toBe(false);
    expect(parse(item, item.draft!, [selected, selected]).success).toBe(false);
    expect(presentation.discoveryErrorText("invalid_resolution")).toMatch(/cited source|claim/i);
  });

  it("limits each explicit resolution save to ten current claims", () => {
    const presentation = requiredModel();
    const item = candidate({ unresolved_claims: Array.from({ length: 11 }, (_, index) => `Claim ${index}`) });
    const selections = item.unresolved_claims.map((claim) => ({ claim, source_url: item.draft!.sources[0].url,
      note: "This claim was checked against the cited source and retained limitations.", resolved: true }));
    expect(presentation.parseEvidenceResolutions).toBeTypeOf("function");
    expect(presentation.parseEvidenceResolutions(item, item.draft!, selections).success).toBe(false);
  });

  it("enforces the shared evidence payload byte limit instead of only character counts", () => {
    const presentation = requiredModel();
    const item = candidate({ unresolved_claims: Array.from({ length: 10 }, (_, index) => `Claim ${index}`) });
    const selections = item.unresolved_claims.map((claim) => ({ claim, source_url: item.draft!.sources[0].url,
      note: "界".repeat(600), resolved: true }));
    expect(presentation.parseEvidenceResolutions(item, item.draft!, selections).success).toBe(false);
  });
});
