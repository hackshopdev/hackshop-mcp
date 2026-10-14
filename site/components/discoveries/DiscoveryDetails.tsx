"use client";

import { useEffect, useState } from "react";
import type { ReverseEngineeringExample as Example } from "@/lib/core/reverse-engineering";
import type { DiscoveryCandidate } from "@/lib/discoveries/types";
import type { DiscoveryClaimResolution, DiscoveryReviewAction } from "./api";
import { aiExecutionEvidence, canApproveDiscovery, formatDiscoveryTime, parseDiscoveryDraftJson, parseEvidenceResolutions, publicationStatusLabel, researchStatusLabel, safeSourceHref, type EvidenceResolutionSelection } from "./model";
import { EvidenceResolutions } from "./EvidenceResolutions";
import styles from "./discoveries.module.css";

type Props = {
  candidate: DiscoveryCandidate;
  busy: boolean;
  stale: boolean;
  onReview: (action: DiscoveryReviewAction, reason?: string) => void | Promise<void>;
  onSave: (draft: Example, resolutions?: DiscoveryClaimResolution[]) => void | boolean | Promise<boolean>;
};

export function DiscoveryDetails({ candidate, busy, stale, onReview, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [draftText, setDraftText] = useState(JSON.stringify(candidate.draft, null, 2));
  const [editError, setEditError] = useState("");
  const [reason, setReason] = useState("");
  const [resolutions, setResolutions] = useState<EvidenceResolutionSelection[]>([]);
  const draft = candidate.draft;
  const aiEvidence = aiExecutionEvidence(candidate);
  const pendingEvidence = resolutions.some((selection) => selection.resolved);
  const editedDraft = editing ? parseDiscoveryDraftJson(draftText) : null;
  const citationDraft = editedDraft?.success ? editedDraft.draft : draft;

  useEffect(() => {
    setDraftText(JSON.stringify(candidate.draft, null, 2));
    setEditing(false);
    setEditError("");
    setResolutions([]);
  }, [candidate.id, candidate.draft_version, candidate.draft]);

  async function save() {
    const result = parseDiscoveryDraftJson(editing ? draftText : JSON.stringify(draft));
    if (!result.success) {
      setEditError(result.error);
      return;
    }
    const decisions = parseEvidenceResolutions(candidate, result.draft, resolutions);
    if (!decisions.success) { setEditError(decisions.error); return; }
    setEditError("");
    if (await onSave(result.draft, decisions.resolutions)) { setEditing(false); setResolutions([]); }
  }

  return (
    <article className={styles.detail} aria-labelledby="discovery-detail-title">
      <header className={styles.detailHeader}>
        <div className={styles.statusRow}>
          <span data-status={candidate.research_status}>{researchStatusLabel(candidate.research_status)}</span>
          <span>{publicationStatusLabel(candidate.publication_status)}</span>
        </div>
        <h2 id="discovery-detail-title" tabIndex={-1}>{draft?.title ?? "Lead awaiting research"}</h2>
        <p className={styles.projectKey}>{candidate.project_key}</p>
        <p className={styles.snapshot}>Draft version {candidate.draft_version} <span>Updated {formatDiscoveryTime(candidate.updated_at)}</span></p>
      </header>

      {stale && <p className={styles.error} role="alert">This draft has changed. Reload the queue before reviewing; the displayed version cannot be submitted again.</p>}
      {editError && <p className={styles.error} role="alert">{editError}</p>}

      {candidate.unresolved_claims.length > 0 && (
        <EvidenceResolutions claims={candidate.unresolved_claims} sources={citationDraft?.sources ?? []} selections={resolutions}
          disabled={busy || stale || !draft || candidate.publication_status !== "unreviewed"} editing={editing}
          onChange={(claim, patch) => setResolutions((previous) => {
            const existing = previous.find((selection) => selection.claim === claim) ?? { claim, source_url: "", note: "", resolved: false };
            return [...previous.filter((selection) => selection.claim !== claim), { ...existing, ...patch }];
          })} onSave={() => void save()} />
      )}

      <div className={styles.detailFacts}>
        <section>
          <h3>Exact hardware and firmware</h3>
          {draft?.exact_models.length ? <ul>{draft.exact_models.map((model) => <li key={model}>{model}</li>)}</ul>
            : <p className={styles.muted}>Exact target not established.</p>}
        </section>
        <section>
          <h3>Device cost and missing parts</h3>
          {draft?.price ? (
            <>
              <p>${draft.price.min_usd.toFixed(2)}{draft.price.max_usd !== draft.price.min_usd ? `–$${draft.price.max_usd.toFixed(2)}` : ""} device only</p>
              <p className={styles.muted}>{draft.price.availability.replaceAll("_", " ")} when checked {draft.price.checked_at}</p>
              <p>{draft.price.note}</p>
            </>
          ) : <p className={styles.muted}>Cost not established. Device price, host, power, case, shipping and tax still need a sourced check.</p>}
        </section>
      </div>

      <section className={styles.detailSection}>
        <h3>What the evidence supports</h3>
        {draft ? <>
          <p>{draft.summary}</p><p>{draft.outcome}</p>
          <dl className={styles.factsLine}>
            <div><dt>Evidence</dt><dd>{draft.evidence.replaceAll("_", " ")}</dd></div>
            <div><dt>Repeatability</dt><dd>{draft.reproducibility.replaceAll("_", " ")}</dd></div>
            <div><dt>Risk</dt><dd>{draft.risk_level}</dd></div>
          </dl>
        </> : <p className={styles.muted}>No researched library draft exists yet.</p>}
      </section>

      <section className={styles.detailSection}>
        <h3>Where AI executes</h3>
        {aiEvidence.length ? aiEvidence.map((text) => <p key={text}>{text}</p>)
          : <p className={styles.muted}>Execution location is not stated in the draft or research notes. Establish whether the hardware runs AI or displays a host’s output.</p>}
      </section>

      {draft && draft.warnings.length > 0 && <section className={styles.detailSection}>
        <h3>Setup and recovery warnings</h3>
        <ul>{draft.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
      </section>}

      <section className={styles.detailSection}>
        <h3>Sources and cited observations</h3>
        {candidate.sources.length ? <ol className={styles.sourceList}>
          {candidate.sources.map((source) => {
            const href = safeSourceHref(source.url);
            return <li key={source.id ?? source.source_key ?? source.url}>
              {href ? <a href={href} target="_blank" rel="noreferrer">{source.label}</a> : <span>{source.label}</span>}
              <p className={styles.sourceMeta}>{source.kind.replaceAll("_", " ")}{source.author ? ` by ${source.author}` : ""}. Checked {source.checked_at}.</p>
              {source.excerpt ? <blockquote>{source.excerpt}</blockquote> : <p className={styles.muted}>Source content has not been retained for review.</p>}
            </li>;
          })}
        </ol> : <p className={styles.muted}>Sources have not been collected.</p>}
      </section>

      {candidate.research_notes && <section className={styles.detailSection}>
        <h3>Research notes</h3><p className={styles.researchNotes}>{candidate.research_notes}</p>
      </section>}

      {candidate.pr_url && safeSourceHref(candidate.pr_url) && <p className={styles.prLink}>
        <a href={candidate.pr_url} target="_blank" rel="noreferrer">Open prepared data PR</a>
      </p>}

      <section className={styles.editorSection}>
        <div className={styles.editorHeading}>
          <h3>Library draft</h3>
          {draft && !editing && <button type="button" disabled={busy || stale} onClick={() => setEditing(true)}>Edit draft</button>}
        </div>
        {editing ? <>
          <label htmlFor="discovery-draft-json">Draft JSON</label>
          <textarea id="discovery-draft-json" className={styles.jsonEditor} value={draftText} onChange={(event) => setDraftText(event.target.value)} disabled={busy || stale} spellCheck={false} autoCorrect="off" autoCapitalize="off" aria-describedby="draft-edit-note" />
          <p id="draft-edit-note" className={styles.muted}>Saving creates a new version and clears any earlier approval.</p>
          <div className={styles.editorActions}>
            <button type="button" className={styles.primaryButton} disabled={busy || stale} onClick={() => void save()}>Save draft</button>
            <button type="button" disabled={busy} onClick={() => { setEditing(false); setEditError(""); setDraftText(JSON.stringify(draft, null, 2)); }}>Cancel edit</button>
          </div>
        </> : <details className={styles.rawDraft}>
          <summary>Inspect draft JSON and snapshot hash</summary>
          <pre tabIndex={0} aria-label="Library draft JSON">{JSON.stringify(draft, null, 2)}</pre>
          <p>Reviewed hash: <code>{candidate.draft_hash ?? "No draft hash yet"}</code></p>
        </details>}
      </section>

      <section className={styles.reviewSection} aria-labelledby="review-title">
        <h3 id="review-title">Review this version</h3>
        <p>Approval prepares a future data PR for the library. It does not publish to the site or merge the PR.</p>
        <label htmlFor="discovery-review-reason">Review note (optional)</label>
        <textarea id="discovery-review-reason" value={reason} onChange={(event) => setReason(event.target.value)} disabled={busy || editing || pendingEvidence || stale} maxLength={600} rows={2} />
        <div className={styles.reviewActions}>
          <button type="button" disabled={busy || editing || pendingEvidence || stale} onClick={() => void onReview("needs_research", reason)}>Needs research</button>
          <button type="button" disabled={busy || editing || pendingEvidence || stale} onClick={() => void onReview("reject", reason)}>Reject</button>
          <button type="button" className={styles.primaryButton} disabled={busy || editing || pendingEvidence || stale || !canApproveDiscovery(candidate)} onClick={() => void onReview("approve", reason)}>Approve for library</button>
        </div>
        {!canApproveDiscovery(candidate) && <p className={styles.muted}>Approval is available only for an unreviewed, complete draft marked ready to review with no unresolved claims.</p>}
        {pendingEvidence && <p className={styles.muted}>Save the selected evidence decisions before reviewing this version.</p>}
      </section>
    </article>
  );
}
