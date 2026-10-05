"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState, type RefObject } from "react";
import { track } from "@/lib/analytics";
import {
  BOARDS,
  STATUS_LABEL,
  UNKNOWN_BOARD_CHECKS,
  boardById,
  searchBoards,
  whatWorks,
  type BoardEntry,
  type SupportStatus,
} from "@/lib/tools/board-lookup";
import { BOARD_PRICES } from "@/lib/tools/board-prices";
import { FAMILY_LABEL } from "@/lib/tools/serial-ports";
import { PRICES_CHECKED_LABEL, SDK_DEVICES_README_URL, SDK_REPO_URL } from "@/lib/tools/sources";
import { CopyCommand } from "../_components/CopyCommand";
import shared from "../tools.module.css";
import styles from "./checker.module.css";

export interface ResolvedLink {
  deviceId: string;
  name: string;
  boardPage: string | null;
  buildPage: string | null;
}

type Selection = { kind: "board"; entry: BoardEntry } | { kind: "unknown"; query: string } | null;

const GROUPS: Array<{ title: string; test: (entry: BoardEntry) => boolean }> = [
  { title: "ESP32 boards on the SDK list", test: (e) => e.family === "esp32" && e.status === "supported" },
  { title: "Experimental ESP32 boards", test: (e) => e.status === "experimental" },
  { title: "Raspberry Pi and Linux", test: (e) => e.family === "linux" },
  { title: "Popular boards that aren't listed", test: (e) => e.status === "not-listed" },
];

const STATUS_CLASS: Record<SupportStatus, string> = {
  supported: styles.statusSupported ?? "",
  experimental: styles.statusExperimental ?? "",
  "not-listed": styles.statusNotListed ?? "",
};

export function BoardChecker({ links }: { links: Record<string, ResolvedLink[]> }) {
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState<Selection>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const focusResult = useRef(false);
  const inputId = useId();
  const listId = useId();

  const matches = useMemo(() => (query.trim() ? searchBoards(query).slice(0, 8) : []), [query]);

  const syncUrl = (params: Record<string, string>) => {
    try {
      const search = new URLSearchParams(params).toString();
      window.history.replaceState(null, "", `${window.location.pathname}${search ? `?${search}` : ""}`);
    } catch {
      // ignore
    }
  };

  const pick = (entry: BoardEntry) => {
    setSelection({ kind: "board", entry });
    setQuery(entry.name);
    syncUrl({ board: entry.id });
    focusResult.current = true;
    track("tool_result_shown", { tool: "board_checker", status: entry.status });
  };

  const submit = () => {
    const text = query.trim();
    if (!text) return;
    const top = searchBoards(text)[0];
    if (top) {
      pick(top);
      return;
    }
    setSelection({ kind: "unknown", query: text });
    syncUrl({ q: text });
    focusResult.current = true;
    track("tool_result_shown", { tool: "board_checker", status: "unknown" });
  };

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const fromId = boardById(params.get("board"));
      if (fromId) {
        setSelection({ kind: "board", entry: fromId });
        setQuery(fromId.name);
        return;
      }
      const q = params.get("q")?.trim();
      if (q) {
        setQuery(q);
        const top = searchBoards(q)[0];
        setSelection(top ? { kind: "board", entry: top } : { kind: "unknown", query: q });
      }
    } catch {
      // ignore malformed URLs
    }
  }, []);

  useEffect(() => {
    if (!focusResult.current) return;
    focusResult.current = false;
    headingRef.current?.focus();
  }, [selection]);

  const showList = query.trim() !== "" && (selection === null || (selection.kind === "board" ? selection.entry.name !== query : selection.query !== query));

  return (
    <div className={styles.checker} id="check" data-testid="board-checker">
      <div className={shared.panel}>
        <form
          className={styles.searchForm}
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <label className={shared.fieldLabel} htmlFor={inputId}>
            Which board do you have?
          </label>
          <div className={styles.searchRow}>
            <input
              id={inputId}
              className={shared.textInput}
              type="search"
              autoComplete="off"
              spellCheck={false}
              placeholder="e.g. SenseCAP Watcher, StickS3, Raspberry Pi 4"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-controls={listId}
              aria-describedby={`${inputId}-hint`}
            />
            <button type="submit" className={styles.checkButton}>
              Check
            </button>
          </div>
          <p className={shared.hint} id={`${inputId}-hint`}>
            Type a name, model or chip. Press Enter or pick from the list.
          </p>
        </form>

        <div id={listId}>
          {showList ? (
            matches.length > 0 ? (
              <ul className={styles.matches} aria-label="Matching boards">
                {matches.map((entry) => (
                  <li key={entry.id}>
                    <button type="button" className={styles.match} onClick={() => pick(entry)}>
                      <span>{entry.name}</span>
                      <span className={`${styles.status} ${STATUS_CLASS[entry.status]}`}>{STATUS_LABEL[entry.status]}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.noMatch}>No board by that name on the SDK lists. Press Check for what to look for.</p>
            )
          ) : null}
        </div>

        <details className={styles.browse}>
          <summary>Browse all {BOARDS.length} boards</summary>
          {GROUPS.map((group) => {
            const entries = BOARDS.filter(group.test);
            return (
              <div key={group.title} className={styles.group}>
                <h3>
                  {group.title} <span>({entries.length})</span>
                </h3>
                <ul>
                  {entries.map((entry) => (
                    <li key={entry.id}>
                      <button type="button" className={styles.browseItem} onClick={() => pick(entry)}>
                        {entry.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </details>
      </div>

      <div aria-live="polite">
        {selection?.kind === "board" ? (
          <BoardResult entry={selection.entry} links={links[selection.entry.id] ?? []} headingRef={headingRef} />
        ) : null}
        {selection?.kind === "unknown" ? <UnknownResult query={selection.query} headingRef={headingRef} /> : null}
      </div>
    </div>
  );
}

function BoardResult({
  entry,
  links,
  headingRef,
}: {
  entry: BoardEntry;
  links: ResolvedLink[];
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  const rows = whatWorks(entry);
  const price = entry.deviceIds.map((id) => BOARD_PRICES[id]).find(Boolean) ?? null;
  // One hackshop page: show it as buttons. Several (the generic Linux entry): list them.
  const primary = links.length === 1 ? links[0]! : null;
  return (
    <article className={styles.result} data-testid="checker-result">
      <div className={styles.resultHead}>
        <span className={`${styles.status} ${styles.statusLarge} ${STATUS_CLASS[entry.status]}`}>
          {STATUS_LABEL[entry.status]}
        </span>
        <h2 ref={headingRef} tabIndex={-1}>
          {entry.name}
        </h2>
        <p className={styles.verdict}>{entry.verdict}</p>
        {entry.chip || entry.display || entry.memory ? (
          <p className={styles.specs}>{[entry.chip, entry.display, entry.memory].filter(Boolean).join(" · ")}</p>
        ) : null}
      </div>

      <dl className={styles.works}>
        {rows.map((row) => (
          <div key={row.label} className={styles.workRow}>
            <dt>{row.label}</dt>
            <dd>
              <span
                className={row.ok === true ? styles.yes : row.ok === false ? styles.no : styles.neutral}
                aria-hidden="true"
              >
                {row.ok === true ? "✓" : row.ok === false ? "✕" : "•"}
              </span>
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      {entry.build || entry.buildNote ? (
        <div className={styles.section}>
          <h3>{entry.family === "linux" ? "Install command" : "Build command"}</h3>
          {entry.build ? <CopyCommand command={entry.build} label="build command" /> : null}
          {entry.buildNote ? <p className={shared.hint}>{entry.buildNote}</p> : null}
          {entry.family === "esp32" ? (
            <p className={shared.hint}>
              Run it in the SDK&apos;s esp32 folder with ESP-IDF 6.0.1 and your SDK token set.
            </p>
          ) : null}
        </div>
      ) : null}

      {entry.flashNotes.length > 0 ? (
        <div className={styles.section}>
          <h3>{entry.family === "linux" ? "Good to know" : "Before you flash"}</h3>
          <ul className={styles.notes}>
            {entry.flashNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
          {entry.backup ? (
            <div className={styles.backup}>
              <p className={styles.backupLabel}>Back up first (from the SDK docs):</p>
              <CopyCommand command={entry.backup} label="backup command" />
            </div>
          ) : null}
        </div>
      ) : null}

      {entry.port ? (
        <p className={styles.port}>
          <strong>USB port:</strong> {FAMILY_LABEL[entry.port]}.{" "}
          <Link href={`/tools/esp32-port-finder?board=${entry.id}`}>Find it on your computer</Link>
        </p>
      ) : null}

      {price ? (
        <p className={styles.price}>
          <strong>Price:</strong> {price.label} at{" "}
          <a href={price.source} target="_blank" rel="noopener noreferrer">
            {price.seller}
          </a>
          {price.note ? ` (${price.note.replace(/\.$/, "")})` : ""}. {PRICES_CHECKED_LABEL}.
        </p>
      ) : null}

      <div className={styles.actions}>
        {primary?.buildPage ? (
          <Link className={styles.primaryLink} href={primary.buildPage}>
            See the build steps
          </Link>
        ) : null}
        {primary?.boardPage ? (
          <Link className={styles.secondaryLink} href={primary.boardPage}>
            Board details
          </Link>
        ) : null}
        <a className={styles.secondaryLink} href={entry.sdkUrl} target="_blank" rel="noopener noreferrer">
          Muse SDK docs
        </a>
      </div>
      {links.length === 0 && entry.status !== "not-listed" ? (
        <p className={shared.hint}>hackshop doesn&apos;t have a build page for this board yet. The SDK docs cover it.</p>
      ) : null}
      {links.length > 1 ? (
        <p className={shared.hint}>
          hackshop build pages:{" "}
          {links.map((link, index) => (
            <span key={link.deviceId}>
              {index > 0 ? ", " : ""}
              <Link href={link.buildPage ?? link.boardPage ?? "#"}>{link.name}</Link>
            </span>
          ))}
        </p>
      ) : null}
      {entry.status === "not-listed" ? <UnknownChecks /> : null}
    </article>
  );
}

function UnknownResult({
  query,
  headingRef,
}: {
  query: string;
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <article className={styles.result} data-testid="checker-result">
      <div className={styles.resultHead}>
        <span className={`${styles.status} ${styles.statusLarge} ${styles.statusNotListed}`}>Not listed</span>
        <h2 ref={headingRef} tabIndex={-1}>
          {query}
        </h2>
        <p className={styles.verdict}>
          That name isn&apos;t on the Muse SDK board lists. It may still work if it&apos;s close to a listed board.
          Check these:
        </p>
      </div>
      <UnknownChecks />
    </article>
  );
}

function UnknownChecks() {
  return (
    <div className={styles.section}>
      <h3>What to check</h3>
      <ol className={styles.checks}>
        {UNKNOWN_BOARD_CHECKS.map((check) => (
          <li key={check.title}>
            <strong>{check.title}.</strong> {check.body}
          </li>
        ))}
      </ol>
      <p className={shared.hint}>
        To add a board, the SDK says to copy the closest board&apos;s settings file and change the chip, button
        pin, status light and flash size.{" "}
        <a href={SDK_DEVICES_README_URL} target="_blank" rel="noopener noreferrer">
          How to add a board
        </a>{" "}
        ·{" "}
        <a href={SDK_REPO_URL} target="_blank" rel="noopener noreferrer">
          Muse Gadgets SDK on GitHub
        </a>
      </p>
    </div>
  );
}
