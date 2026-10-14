"use client";

import { useId } from "react";
import type { ReverseEngineeringExample } from "@/lib/core/reverse-engineering";
import type { EvidenceResolutionSelection } from "./model";
import styles from "./discoveries.module.css";

type Props = {
  claims: string[];
  sources: ReverseEngineeringExample["sources"];
  selections: EvidenceResolutionSelection[];
  disabled: boolean;
  editing: boolean;
  onChange: (claim: string, patch: Partial<Omit<EvidenceResolutionSelection, "claim">>) => void;
  onSave: () => void;
};

export function EvidenceResolutions({ claims, sources, selections, disabled, editing, onChange, onSave }: Props) {
  const prefix = useId();
  const selectedCount = selections.filter((selection) => selection.resolved).length;
  const citedSources = sources.filter((source, index) => sources.findIndex((other) => other.url === source.url) === index);
  return <section className={styles.evidenceGaps} aria-labelledby={`${prefix}-title`}>
    <h3 id={`${prefix}-title`}>Still needs evidence</h3>
    <p className={styles.resolutionNote}>Unknowns may remain if the saved draft explicitly states the limitation; cite why you are accepting it. Resolving a review gap does not establish hardware compatibility.</p>
    {[...new Set(claims)].map((claim, index) => {
      const selection = selections.find((item) => item.claim === claim);
      const sourceId = `${prefix}-source-${index}`;
      const noteId = `${prefix}-note-${index}`;
      const checkboxId = `${prefix}-resolve-${index}`;
      const removedSource = !!selection?.source_url && !citedSources.some((source) => source.url === selection.source_url);
      return <fieldset className={styles.resolutionClaim} key={claim} disabled={disabled}>
        <legend>{claim}</legend>
        <label htmlFor={sourceId}>Cited source</label>
        <select id={sourceId} value={selection?.source_url ?? ""} onChange={(event) => onChange(claim, { source_url: event.target.value })} aria-invalid={removedSource || undefined}>
          <option value="">Choose a source cited in the draft</option>
          {removedSource && <option value={selection!.source_url} disabled>Previously selected source was removed from the draft</option>}
          {citedSources.map((source) => <option key={source.url} value={source.url}>{source.label} ({source.url})</option>)}
        </select>
        <label htmlFor={noteId}>Reviewer explanation</label>
        <textarea id={noteId} value={selection?.note ?? ""} onChange={(event) => onChange(claim, { note: event.target.value })} minLength={20} maxLength={600} rows={3} placeholder="Explain what the citation supports, including any limitation retained in the draft." />
        <label className={styles.resolveCheckbox} htmlFor={checkboxId}>
          <input id={checkboxId} type="checkbox" checked={selection?.resolved ?? false} onChange={(event) => onChange(claim, { resolved: event.target.checked })} />
          <span>Resolve this claim when saved</span>
        </label>
        {removedSource && <p className={styles.resolutionNote}>Choose another cited source before saving this decision.</p>}
      </fieldset>;
    })}
    <p className={styles.resolutionNote}>Only checked claims are submitted. Save up to ten decisions at a time; all other claims remain unresolved.</p>
    <button type="button" className={styles.primaryButton} disabled={disabled || selectedCount === 0} onClick={onSave}>{editing ? "Save draft and evidence decisions" : "Save evidence decisions"}</button>
  </section>;
}
