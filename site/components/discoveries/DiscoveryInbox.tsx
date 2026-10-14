"use client";

import { useCallback, useEffect, useState } from "react";
import type { DiscoveryCandidate, DiscoveryInbox as Inbox } from "@/lib/discoveries/types";
import type { ReverseEngineeringExample } from "@/lib/core/reverse-engineering";
import { DiscoveryApiError, intakeDiscovery, loadDiscoveryInbox, reviewDiscovery, saveDiscoveryDraft, type DiscoveryClaimResolution, type DiscoveryReviewAction } from "./api";
import { DiscoveryAccess, type DiscoveryAccessState } from "./DiscoveryAccess";
import { DiscoveryDetails } from "./DiscoveryDetails";
import { discoveryErrorText, formatDiscoveryTime, providerStatusLabel, publicationStatusLabel, researchStatusLabel } from "./model";
import styles from "./discoveries.module.css";

type Filter = "all" | "ready" | "evidence" | "approved";
const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" }, { id: "ready", label: "Ready to review" },
  { id: "evidence", label: "Needs evidence" }, { id: "approved", label: "Approved" },
];

export function DiscoveryInbox({ signInEnabled }: { signInEnabled: boolean }) {
  const [data, setData] = useState<Inbox | null>(null);
  const [busy, setBusy] = useState<string | null>("load");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [access, setAccess] = useState<DiscoveryAccessState | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [staleId, setStaleId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [url, setUrl] = useState("");

  const fail = useCallback((caught: unknown, candidateId?: string) => {
    const apiError = caught instanceof DiscoveryApiError ? caught : null;
    const code = apiError?.code === "reviewer_access_unconfigured" ? "auth_unavailable" : apiError?.code ?? "request_failed";
    if (["sign_in_required", "reviewer_required", "auth_unavailable"].includes(code)) {
      setAccess(code as DiscoveryAccessState);
      setData(null);
    }
    if (apiError?.code === "stale_draft" && candidateId) setStaleId(candidateId);
    setError(discoveryErrorText(code, apiError?.message));
  }, []);

  const reload = useCallback(async (selectId?: string) => {
    setBusy("load");
    setError("");
    try {
      const live = await loadDiscoveryInbox();
      setData(live);
      setStaleId(null);
      setSelectedId((previous) => selectId ?? (live.candidates.some((item) => item.id === previous) ? previous : live.candidates[0]?.id ?? null));
    } catch (caught) {
      setData(null);
      fail(caught);
    } finally { setBusy(null); }
  }, [fail]);

  useEffect(() => { void reload(); }, [reload]);

  async function refreshedAfterSave(candidate: DiscoveryCandidate, message: string) {
    setNotice(message);
    setFilter("all");
    setSearch("");
    try {
      const live = await loadDiscoveryInbox();
      setData(live);
      setSelectedId(candidate.id);
      setStaleId(null);
    } catch (caught) {
      setData(null);
      fail(caught);
      setNotice(`${message} Inbox totals could not be reloaded.`);
    }
  }

  async function intake(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy("intake"); setError(""); setNotice("");
    try {
      const item = await intakeDiscovery(url);
      setUrl("");
      await refreshedAfterSave(item, "URL added to the private research queue. A researched draft is still required before approval.");
    } catch (caught) { fail(caught); }
    finally { setBusy(null); }
  }

  const selected = data?.candidates.find((candidate) => candidate.id === selectedId) ?? null;

  async function review(action: DiscoveryReviewAction, reason?: string) {
    if (!selected || busy || staleId === selected.id) return;
    const snapshot = selected;
    setBusy("review"); setError(""); setNotice("");
    try {
      const saved = await reviewDiscovery(snapshot, action, reason);
      const message = action === "approve" ? "Approval recorded for this draft. A future data PR can now be prepared; nothing was published."
        : action === "reject" ? "Rejection recorded. The candidate remains in the private audit queue."
          : "Marked for more research. Approval remains unavailable until the evidence gaps are resolved.";
      await refreshedAfterSave(saved, message);
    } catch (caught) { fail(caught, snapshot.id); }
    finally { setBusy(null); }
  }

  async function save(draft: ReverseEngineeringExample, resolutions?: DiscoveryClaimResolution[]): Promise<boolean> {
    if (!selected || busy || staleId === selected.id) return false;
    const snapshot = selected;
    setBusy("save"); setError(""); setNotice("");
    try {
      const saved = await saveDiscoveryDraft(snapshot, draft, fetch, resolutions);
      const decisionCount = resolutions?.length ?? 0;
      await refreshedAfterSave(saved, `Draft saved as a new version. Earlier approval has been cleared.${decisionCount ? ` ${decisionCount} evidence decision${decisionCount === 1 ? " was" : "s were"} recorded; ${saved.unresolved_claims.length} claim${saved.unresolved_claims.length === 1 ? " remains" : "s remain"} unresolved.` : ""}`);
      return true;
    } catch (caught) { fail(caught, snapshot.id); return false; }
    finally { setBusy(null); }
  }

  if (access) return <DiscoveryAccess state={access} signInEnabled={signInEnabled} />;

  const matches = (data?.candidates ?? []).filter((candidate) => {
    if (filter === "ready" && candidate.research_status !== "ready_for_review") return false;
    if (filter === "evidence" && candidate.research_status !== "needs_evidence") return false;
    if (filter === "approved" && candidate.publication_status === "unreviewed") return false;
    const text = [candidate.project_key, candidate.draft?.title, candidate.draft?.device_name, ...(candidate.draft?.exact_models ?? [])].join(" ").toLowerCase();
    return !search.trim() || text.includes(search.trim().toLowerCase());
  });

  return <div className={styles.inbox}>
    <div className={styles.topBar}>
      {data ? <dl className={styles.stats}>
        <div><dt>Candidates</dt><dd>{data.stats.total}</dd></div>
        <div><dt>Needs review</dt><dd>{data.stats.needs_review}</dd></div>
        <div><dt>Needs evidence</dt><dd>{data.stats.needs_evidence}</dd></div>
        <div><dt>Approved</dt><dd>{data.stats.approved}</dd></div>
        <div><dt>Published</dt><dd>{data.stats.published}</dd></div>
      </dl> : <p className={styles.muted}>Live queue totals have not been checked.</p>}
      <button type="button" disabled={Boolean(busy)} onClick={() => void reload()}>Reload queue</button>
    </div>
    {notice && <p className={styles.notice} role="status">{notice}</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    <form className={styles.manualIntake} onSubmit={(event) => void intake(event)}>
      <label htmlFor="discovery-source-url">Add an example URL</label>
      <div className={styles.intakeRow}>
        <input id="discovery-source-url" type="url" value={url} onChange={(event) => setUrl(event.target.value)} required disabled={Boolean(busy)} placeholder="https://x.com/… or a primary project URL" autoComplete="off" />
        <button type="submit" disabled={Boolean(busy) || !url.trim()}>Add to research queue</button>
      </div>
      <p>Intake creates or finds a private lead. It does not add an entry to the public library.</p>
    </form>

    {data && <details className={styles.runs} open>
      <summary>Daily runs and provider coverage</summary>
      {data.runs.length ? <div className={styles.runList}>
        {data.runs.slice(0, 6).map((run) => <article className={styles.run} key={run.id}>
          <div className={styles.runHead}><h3>{providerStatusLabel(run.status)}</h3><p>{formatDiscoveryTime(run.started_at)}{run.finished_at ? ` to ${formatDiscoveryTime(run.finished_at)}` : "; no finish recorded"}</p></div>
          <dl className={styles.providers}>
            {Object.entries(run.provider_status).map(([provider, status]) => <div key={provider}><dt>{provider}</dt><dd>{providerStatusLabel(status)}</dd></div>)}
            {run.grok_receipt && <div><dt>GrokBot receipt</dt><dd>{providerStatusLabel(String(run.grok_receipt.status ?? "pending"))}</dd></div>}
          </dl>
          {run.coverage_notes.length > 0 && <ul>{run.coverage_notes.map((note) => <li key={note}>{note}</li>)}</ul>}
        </article>)}
      </div> : <p className={styles.empty}>No daily-run observations have been recorded. Provider coverage has not been established.</p>}
    </details>}

    {busy === "load" && <p className={styles.loading} role="status">Loading the private queue…</p>}
    {data && <div className={styles.workspace}>
      <aside className={styles.ledger} aria-label="Discovery candidates" tabIndex={0}>
        <h2>Research queue</h2>
        <label htmlFor="discovery-search">Find a device or project</label>
        <input id="discovery-search" value={search} onChange={(event) => setSearch(event.target.value)} type="search" />
        <div className={styles.filters} aria-label="Candidate status filters">
          {FILTERS.map((item) => <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}</button>)}
        </div>
        {matches.length ? <ul className={styles.candidateList}>
          {matches.map((candidate) => <li key={candidate.id}>
            <button className={styles.candidateButton} type="button" disabled={Boolean(busy)} aria-pressed={candidate.id === selectedId} onClick={() => {
              setSelectedId(candidate.id); setError("");
              requestAnimationFrame(() => document.getElementById("discovery-detail-title")?.focus());
            }}>
              <strong>{candidate.draft?.device_name ?? candidate.project_key}</strong>
              <span data-status={candidate.research_status}>{researchStatusLabel(candidate.research_status)}</span>
              <span>{publicationStatusLabel(candidate.publication_status)}</span>
            </button>
          </li>)}
        </ul> : <p className={styles.listEmpty}>{data.candidates.length ? "No candidates match these filters." : "No candidates have been returned by the live queue. Check the run and provider observations above."}</p>}
      </aside>
      {selected ? <DiscoveryDetails key={selected.id} candidate={selected} busy={Boolean(busy)} stale={staleId === selected.id} onReview={review} onSave={save} />
        : <section className={styles.empty}>Select a candidate to inspect its evidence, draft and review state.</section>}
    </div>}
  </div>;
}
