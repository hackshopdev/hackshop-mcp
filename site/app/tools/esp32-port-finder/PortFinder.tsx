"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { boardById } from "@/lib/tools/board-lookup";
import {
  FAMILY_LABEL,
  OPERATING_SYSTEMS,
  detectOs,
  familyForBoard,
  flashCommandFor,
  isOsId,
  notShowingUpChecklist,
  portBoardChoices,
  portGuide,
  type OsId,
  type PortFamily,
} from "@/lib/tools/serial-ports";
import { CopyCommand } from "../_components/CopyCommand";
import shared from "../tools.module.css";
import styles from "./ports.module.css";

const CHOICES = portBoardChoices();
const NATIVE = CHOICES.filter((choice) => choice.family === "native");
const BRIDGE = CHOICES.filter((choice) => choice.family !== "native");

export function PortFinder() {
  const [os, setOs] = useState<OsId>("mac");
  const [boardId, setBoardId] = useState<string>("");

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const osParam = params.get("os");
      if (isOsId(osParam)) setOs(osParam);
      else {
        const guessed = detectOs(navigator.userAgent);
        if (guessed) setOs(guessed);
      }
      const board = params.get("board");
      if (board && CHOICES.some((choice) => choice.id === board)) setBoardId(board);
    } catch {
      // keep defaults
    }
  }, []);

  const update = (nextOs: OsId, nextBoard: string) => {
    setOs(nextOs);
    setBoardId(nextBoard);
    try {
      const params = new URLSearchParams({ os: nextOs, ...(nextBoard ? { board: nextBoard } : {}) });
      window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
    } catch {
      // ignore
    }
  };

  const family: PortFamily = familyForBoard(boardId);
  const guide = useMemo(() => portGuide(os, family), [os, family]);
  const checklist = useMemo(() => notShowingUpChecklist(os, family, boardId), [os, family, boardId]);
  const entry = boardById(boardId);
  const flash = os === "windows" ? null : flashCommandFor(entry?.build);

  return (
    <div className={styles.finder} data-testid="port-finder">
      <div className={`${shared.panel} ${styles.controls}`}>
        <fieldset className={shared.segmented}>
          <legend>Your computer</legend>
          {OPERATING_SYSTEMS.map((option) => (
            <button
              type="button"
              key={option.id}
              className={shared.segmentButton}
              aria-pressed={os === option.id}
              onClick={() => update(option.id, boardId)}
              data-os={option.id}
            >
              {option.label}
            </button>
          ))}
        </fieldset>
        <div>
          <label className={shared.fieldLabel} htmlFor="port-board">
            Your board
          </label>
          <select
            id="port-board"
            className={shared.select}
            value={boardId}
            onChange={(event) => update(os, event.target.value)}
          >
            <option value="">Not sure, or not listed</option>
            <optgroup label="Native USB (ESP32-S3, C5, C6)">
              {NATIVE.map((choice) => (
                <option key={choice.id} value={choice.id}>
                  {choice.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="USB bridge chip (CH340, CH342, CH9102)">
              {BRIDGE.map((choice) => (
                <option key={choice.id} value={choice.id}>
                  {choice.name}
                </option>
              ))}
            </optgroup>
          </select>
          <p className={shared.hint}>{FAMILY_LABEL[family]}</p>
        </div>
      </div>

      <div className={styles.answer} aria-live="polite">
        <section className={styles.card} aria-labelledby="port-run">
          <h2 id="port-run">1. Run this</h2>
          {guide.commands.map((command) => (
            <div key={command.command} className={styles.command}>
              <p className={styles.commandLabel}>{command.label}</p>
              <CopyCommand command={command.command} label={command.label.toLowerCase()} />
            </div>
          ))}
          {os === "windows" ? (
            <p className={shared.hint}>Or open Device Manager and expand Ports (COM &amp; LPT).</p>
          ) : null}
        </section>

        <section className={styles.card} aria-labelledby="port-look">
          <h2 id="port-look">2. Look for</h2>
          <ul className={styles.names}>
            {guide.looksLike.map((name) => (
              <li key={name}>
                <code>{name}</code>
              </li>
            ))}
          </ul>
          <p className={styles.summary} data-testid="port-summary">
            {guide.summary}
          </p>
        </section>

        {flash ? (
          <section className={styles.card} aria-labelledby="port-flash">
            <h2 id="port-flash">3. Flash with that port</h2>
            <CopyCommand command={flash} label="flash command" />
            <p className={shared.hint}>
              Swap PORT for the name you found. Run it in the SDK&apos;s esp32 folder.{" "}
              {entry ? <Link href={`/tools/does-my-board-run-muse?board=${entry.id}#check`}>More about this board</Link> : null}
            </p>
          </section>
        ) : null}
      </div>

      <section className={styles.checklist} aria-labelledby="not-showing">
        <h2 id="not-showing">Not showing up? Check these in order</h2>
        <ol>
          {checklist.map((item) => (
            <li key={item.id} data-check={item.id}>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
              {item.command ? <CopyCommand command={item.command} label={item.title.toLowerCase()} /> : null}
              <a className={styles.source} href={item.source} target="_blank" rel="noopener noreferrer">
                Source
                <span className="sr-only">: {item.title}</span>
              </a>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
