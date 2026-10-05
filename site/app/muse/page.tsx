import Link from "next/link";
import { DifficultyBadge, DifficultyLegend } from "@/components/DifficultyBadge";
import { GadgetPlanner } from "@/components/GadgetPlanner";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { StartBuildButton } from "@/components/StartBuildButton";
import { TellMyAgent } from "@/components/TellMyAgent";
import { GENERAL_AGENT_PROMPT } from "@/lib/agent-prompts";
import { boardPath } from "@/lib/board-slugs";
import { buildPlanForDevice } from "@/lib/build-plan-data";
import { hasImage } from "@/lib/image-sources";
import { getMusePageData, type MuseBoardRow } from "@/lib/muse-page";
import { pageMetadata } from "@/lib/page-metadata";
import { TEMPLATES } from "@/lib/templates";
import { difficultyFor, difficultyMap } from "@/lib/ui/difficulty";
import { humanNote, plainTierLabel } from "@/lib/ui/labels";
import { boardAndTotalLabel } from "@/lib/ui/price";
import styles from "./muse.module.css";

const DESCRIPTION =
  "Which ESP32 boards and Linux boxes work with Meta's Muse Gadgets SDK, what you get on each (voice, images, touch, camera, home-network tunnel), how to build one, the SDK token terms, and free printable stands.";

const SITE_URL = "https://www.hackshop.dev";

export const metadata = pageMetadata(
  "Muse Gadgets boards: every supported board compared · Hackshop",
  DESCRIPTION,
  "/muse",
);

export const dynamic = "force-static";

export default function MusePage() {
  const data = getMusePageData();
  const fullUiRows = data.esp32.boards.filter((row) => row.tier === "full-ui");
  const statusRows = data.esp32.boards.filter((row) => row.tier === "status");
  const museTemplates = TEMPLATES.filter((template) => template.category === "agents");
  const services = fabricationServices(data.esp32.boards);
  const totals = new Map(
    data.esp32.boards.map((row) => {
      const total = buildPlanForDevice(row.device.id)?.shopping_list.est_total_usd;
      return [row.device.id, typeof total === "number" ? Math.round(total) : null] as const;
    }),
  );
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: data.faq.map((entry) => ({
        "@type": "Question",
        name: entry.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: entry.answer,
        },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement: data.esp32.boards.map((row, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: row.device.name,
        url: `${SITE_URL}/muse#${row.device.id}`,
      })),
    },
  ];

  return (
    <main className={styles.page}>
      <SiteHeader />
      <div className={styles.shell}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        <header className={styles.hero}>
          <p className={styles.eyebrow}>
            Muse Gadgets · launched {formatHumanDate(data.esp32.platform.launched)}
          </p>
          <h1>Give Muse a body</h1>
          <p>
            {data.esp32.platform.summary} Meta&apos;s SDK is open source
            (Apache-2.0); this page tracks which boards it supports and what
            each one can do.
          </p>
          <div className={styles.heroActions}>
            <a className={styles.button} href="#start">
              Start a build
            </a>
            <TellMyAgent prompt={GENERAL_AGENT_PROMPT} surface="muse_hero" />
            <a className={styles.secondaryButton} href="#compare">
              Compare the boards
            </a>
            <a className={styles.secondaryButton} href="/store">
              Shop the parts
            </a>
          </div>
          <p className={styles.verifyLine}>
            Last verified {data.esp32.platform.last_verified} · Sources linked below.
          </p>
        </header>

        <section className={styles.section} aria-labelledby="how-to-start">
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>How to start</p>
            <h2 id="how-to-start">Pick a board, start a build, hand it to your agent</h2>
          </div>
          <div className={styles.startGrid}>
            {[
              ["1", "Answer a few questions or pick a board", "Tell the planner below what you want, or compare the boards further down. Not sure? The M5Stack StickS3 is a cheap pocket board with a screen and a mic."],
              ["2", "Start this build", "It saves the parts list with store links, print files and a step checklist to My builds. You can also save just the idea and pick a board later."],
              ["3", "Tell your agent", "Copy the prompt or open the build in Claude, ChatGPT, Codex, Cursor or Muse Code. It walks you through ordering, assembly, flashing and pairing."],
            ].map(([number, title, body]) => (
              <article className={styles.faqItem} key={number}>
                <span className={styles.smallPill}>{number}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
          <div className={styles.plannerPanel} id="start">
            <GadgetPlanner
              source="muse"
              readQuery
              subhead="Answer a few quick questions, describe the Muse gadget you want, or both. We'll pick boards that can do it, then save it to My builds."
              difficulties={difficultyMap()}
            />
          </div>
        </section>

        <section className={styles.section} aria-labelledby="compare">
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>ESP32 device SDK</p>
            <h2 id="compare">Compare the boards</h2>
          </div>
          <div className={styles.tableFrame}>
            <div className={styles.tableWrap}>
              <table className={styles.compareTable}>
                <caption className={styles.srOnly}>
                  Muse Gadgets ESP32 board feature comparison
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Board</th>
                    <th scope="col">Price</th>
                    <th scope="col">Camera</th>
                    <th scope="col">Type</th>
                    <th scope="col">How hard</th>
                    <th scope="col">Voice</th>
                    <th scope="col">Images</th>
                    <th scope="col">Touch</th>
                    <th scope="col">Air sensors</th>
                    <th scope="col">Home tunnel</th>
                    <th scope="col">Printable</th>
                  </tr>
                </thead>
                <tbody>
                  {data.esp32.boards.map((row) => (
                    <tr key={row.device.id}>
                      <th scope="row">
                        <div>
                          <Link href={boardPath(row.device.id) ?? `/build/${row.device.id}`}>
                            {row.device.name}
                          </Link>
                        </div>
                        <div style={{ marginTop: 6 }}>
                          <StartBuildButton
                            className={styles.tableStart}
                            deviceId={row.device.id}
                            source="muse_table"
                          />
                        </div>
                      </th>
                      <td className={styles.priceCell}>
                        <span>{row.priceLabel}</span>
                        {totals.get(row.device.id) ? (
                          <span className={styles.priceTotal}>
                            about ${totals.get(row.device.id)} with cable/parts
                          </span>
                        ) : null}
                      </td>
                      <BooleanCell value={row.board.features.camera === true} />
                      <td>
                        <TierPill row={row} />
                      </td>
                      <td>
                        {difficultyFor(row.device.id) ? (
                          <DifficultyBadge difficulty={difficultyFor(row.device.id)} compact />
                        ) : (
                          <NoValue />
                        )}
                      </td>
                      <td>{row.voiceLabel ?? <NoValue />}</td>
                      <td>{row.imageLabel ?? <NoValue />}</td>
                      <BooleanCell value={row.board.features.touch === true} />
                      <BooleanCell value={row.board.features.air_sensors === true} />
                      <BooleanCell value={row.board.features.home_tunnel === true} />
                      <td>
                        {row.printables[0] ? (
                          <a href={`#${row.device.id}`}>Stand</a>
                        ) : (
                          <NoValue />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <ul className={styles.compareCards} aria-label="Muse Gadgets ESP32 boards">
            {data.esp32.boards.map((row) => (
              <CompareCard row={row} total={totals.get(row.device.id) ?? null} key={row.device.id} />
            ))}
          </ul>
          <DifficultyLegend />
        </section>

        <section className={styles.section} aria-labelledby="board-cards">
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>ESP32 boards</p>
            <h2 id="board-cards">Every board in detail</h2>
          </div>
          <BoardGroup title={plainTierLabel("full-ui") ?? "Full UI"} rows={fullUiRows} />
          <BoardGroup title={plainTierLabel("status") ?? "Status"} rows={statusRows} />
        </section>

        <section className={styles.section} aria-labelledby="build">
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>Firmware path</p>
            <h2 id="build">How to build one</h2>
          </div>
          <ol className={styles.steps}>
            {data.esp32.platform.setup_steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <h3>Or let a coding agent do it:</h3>
          <pre className={styles.codeBlock}>
            <code>{data.esp32.platform.agent_quickstart}</code>
          </pre>
          <p className={styles.callout}>
            Your SDK token ships inside the firmware: never commit it or paste
            it into a public repo.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="linux">
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>Linux device SDK</p>
            <h2 id="linux">Turn a Linux box into a Muse gadget</h2>
            <p>{data.linux.platform.summary}</p>
          </div>
          <div className={styles.split}>
            <div>
              <h3>Official boards</h3>
              <ul className={styles.compactList}>
                {data.linux.officialBoards.map((row) => (
                  <li key={row.device.id}>
                    <strong>{row.device.name}</strong> · {row.priceLabel} ·{" "}
                    {humanNote(row.board.note) || row.board.note}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Revive an old mini PC</h3>
              <ul className={styles.compactList}>
                {data.linux.possibleBoards.map((row) => (
                  <li key={row.device.id}>
                    <strong>{row.device.name}</strong> · {row.priceLabel} ·{" "}
                    {row.board.note}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <h3>Built-in commands</h3>
          <ul className={styles.pillList}>
            {(data.linux.platform.commands ?? []).map((command) => (
              <li key={command}>
                <code>{command}</code>
              </li>
            ))}
          </ul>
          {data.linux.platform.extending ? <p>{data.linux.platform.extending}</p> : null}
          <p className={styles.callout}>{data.linux.platform.caveats[0]}</p>
        </section>

        <section className={styles.section} aria-labelledby="print">
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>Fabrication package</p>
            <h2 id="print">Print it, or get it made</h2>
          </div>
          <p>
            Each package includes an STL for printing, STEP for CAD/CNC, and a
            fab.json file with print settings and checks.
          </p>
          <p>
            Need a stand for a board that doesn&apos;t have one yet?{" "}
            <a href="https://github.com/hackshopdev/hackshop-mcp/issues/new?title=Printable%20stand%20request">
              Request one
            </a>
            .
          </p>
          <div className={styles.serviceGrid}>
            {services.map((service) => (
              <a key={`${service.process}-${service.name}`} href={service.url}>
                {service.name} · {service.process}
              </a>
            ))}
          </div>
          <p className={styles.callout}>Hackshop never places orders for you.</p>
        </section>

        <section className={styles.section} aria-labelledby="terms">
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>SDK token terms</p>
            <h2 id="terms">The fine print (SDK token terms)</h2>
          </div>
          <p>
            {data.esp32.platform.terms.summary}{" "}
            <a href={data.esp32.platform.terms.url}>Read the terms</a>.
          </p>
          <ul className={styles.compactList}>
            <li>Personal and non-commercial use only.</li>
            <li>≤ {data.esp32.platform.terms.max_devices_per_token} devices per token.</li>
            <li>No selling or public listing.</li>
            <li>Meta can revoke at any time.</li>
          </ul>
        </section>

        <section className={styles.section} aria-labelledby="caveats">
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>Limits</p>
            <h2 id="caveats">Caveats</h2>
          </div>
          <ul className={styles.compactList}>
            {data.esp32.platform.caveats.map((caveat) => (
              <li key={caveat}>{caveat}</li>
            ))}
          </ul>
        </section>

        <section className={styles.section} aria-labelledby="faq">
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>Common questions</p>
            <h2 id="faq">FAQ</h2>
          </div>
          <div className={styles.faqList}>
            {data.faq.map((entry) => (
              <article className={styles.faqItem} key={entry.question}>
                <h3>{entry.question}</h3>
                <p>{entry.answer}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section} aria-labelledby="sources">
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>Primary links</p>
            <h2 id="sources">Sources</h2>
          </div>
          <ul className={styles.sourceList}>
            {data.sources.map((source) => (
              <li key={source}>
                <a href={source}>{source}</a>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.section} aria-labelledby="templates">
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>Start from an idea</p>
            <h2 id="templates">Gadget ideas</h2>
          </div>
          <div className={styles.templateGrid}>
            {museTemplates.map((template) => (
              <article className={styles.templateCard} key={template.slug}>
                <span className={styles.smallPill}>{viabilityLabel(template.viability)}</span>
                <h3>{template.title}</h3>
                <p>{template.blurb}</p>
                {template.device_id ? (
                  <StartBuildButton
                    className={styles.button}
                    deviceId={template.device_id}
                    idea={template.prompt}
                    source="muse_template"
                    label="Start this build"
                  />
                ) : null}
              </article>
            ))}
          </div>
        </section>
      </div>
      <SiteFooter />
    </main>
  );
}

function viabilityLabel(viability: string): string {
  if (viability === "official") return "Official SDK";
  if (viability === "verified") return "Community verified";
  if (viability === "iffy") return "Works with caveats";
  return "Experimental";
}

function BoardGroup({ title, rows }: { title: string; rows: MuseBoardRow[] }) {
  return (
    <div className={styles.boardGroup}>
      <h3>{title}</h3>
      <div className={styles.cardGrid}>
        {rows.map((row) => (
          <BoardCard row={row} key={row.device.id} />
        ))}
      </div>
    </div>
  );
}

function BoardCard({ row }: { row: MuseBoardRow }) {
  return (
    <article className={styles.boardCard} id={row.device.id}>
      <div className={styles.imageBox}>
        {hasImage(row.device.id) ? (
          <img
            src={`/api/img?slug=${row.device.id}`}
            alt={row.device.name}
            loading="lazy"
            decoding="async"
            width={640}
            height={480}
          />
        ) : (
          <span>No image</span>
        )}
      </div>
      <div className={styles.cardBody}>
        <div className={styles.cardTop}>
          <h3>{row.device.name}</h3>
          <TierPill row={row} />
        </div>
        <DifficultyBadge difficulty={difficultyFor(row.device.id)} />
        <p>{humanNote(row.device.notes)}</p>
        <h4>What works</h4>
        <ul className={styles.workList}>
          {row.whatWorks.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <details className={styles.devDetails}>
          <summary>Developer details</summary>
          <p>{row.board.note}</p>
          <h4>Build command</h4>
          <pre className={styles.cardCode}>
            <code>{row.board.build}</code>
          </pre>
        </details>
        <div className={styles.linkRow}>
          <StartBuildButton
            className={styles.button}
            deviceId={row.device.id}
            source="muse_card"
          />
          <Link className={styles.secondaryButton} href={`/build/${row.device.id}`}>
            Build steps
          </Link>
          {boardPath(row.device.id) ? (
            <Link href={boardPath(row.device.id) ?? "#"}>Board details</Link>
          ) : null}
          {row.device.firmware_links.map((link) => (
            <a href={link} key={link}>
              {linkLabel(link)}
            </a>
          ))}
        </div>
        {row.printables.length > 0 ? (
          row.printables.map((part) => (
            <div className={styles.printPanel} key={part.urls.fab}>
              <h4>Printable stand</h4>
              <div className={styles.svgBox}>
                <img
                  src={part.urls.svg}
                  alt={`${row.device.name} printable stand preview`}
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <dl className={styles.partStats}>
                {part.bboxLabel ? (
                  <>
                    <dt>Bbox</dt>
                    <dd>{part.bboxLabel}</dd>
                  </>
                ) : null}
                {part.estimatedMassLabel ? (
                  <>
                    <dt>Filament</dt>
                    <dd>{part.estimatedMassLabel}</dd>
                  </>
                ) : null}
              </dl>
              <div className={styles.linkRow}>
                <a href={part.urls.stl}>STL</a>
                <a href={part.urls.step}>STEP</a>
                <a href={part.urls.fab}>fab.json</a>
              </div>
              {part.caveat ? <p className={styles.caveat}>{part.caveat}</p> : null}
              {part.sourceUrl && part.sourceHost ? (
                <p className={styles.dimensionSource}>
                  Dimension source: <a href={part.sourceUrl}>{part.sourceHost}</a>
                </p>
              ) : null}
            </div>
          ))
        ) : (
          <p className={styles.mutedLine}>
            {row.fabricationNote}
            {row.fabricationNote.startsWith("No printable stand yet") ? (
              <>
                {" "}
                <a
                  href={`https://github.com/hackshopdev/hackshop-mcp/issues/new?title=${encodeURIComponent(`Printable stand for ${row.device.name}`)}`}
                >
                  Request one
                </a>
              </>
            ) : null}
          </p>
        )}
      </div>
    </article>
  );
}

function TierPill({ row }: { row: MuseBoardRow }) {
  return (
    <span className={styles.tierWrap}>
      <span className={row.tier === "full-ui" ? styles.fullPill : styles.statusPill}>
        {plainTierLabel(row.tier) ?? row.tierLabel}
      </span>
      {row.board.eol ? <span className={styles.eolPill}>EOL</span> : null}
    </span>
  );
}

// Phones get stacked cards instead of the wide table (UX-002).
function CompareCard({ row, total }: { row: MuseBoardRow; total: number | null }) {
  const f = row.board.features;
  const hasScreen = f.images !== "none" || (typeof f.display_in === "number" && f.display_in > 0) || row.tier === "full-ui";
  const checks: Array<{ label: string; value: boolean; note?: string }> = [
    { label: "Voice", value: row.voiceLabel !== null },
    { label: "Screen", value: hasScreen },
    { label: "Camera", value: f.camera === true },
    { label: "Battery", value: f.battery === "yes" || f.battery === "optional", note: f.battery === "optional" ? "optional" : undefined },
  ];
  const price = boardAndTotalLabel(row.priceLabel, total);
  return (
    <li className={styles.compareCard}>
      <div className={styles.compareCardTop}>
        <Link href={boardPath(row.device.id) ?? `/build/${row.device.id}`} className={styles.compareCardName}>
          {row.device.name}
        </Link>
        <TierPill row={row} />
      </div>
      {price ? <p className={styles.compareCardPrice}>{price}</p> : null}
      <ul className={styles.compareChecks}>
        {checks.map((check) => (
          <li key={check.label} className={check.value ? styles.checkYes : styles.checkNo}>
            <span aria-hidden="true">{check.value ? "✓" : "—"}</span> {check.label}
            {check.note ? <em> ({check.note})</em> : null}
            <span className={styles.srOnly}>{check.value ? ": yes" : ": no"}</span>
          </li>
        ))}
      </ul>
      <DifficultyBadge difficulty={difficultyFor(row.device.id)} />
      <StartBuildButton className={styles.button} deviceId={row.device.id} source="muse_card_mobile" />
    </li>
  );
}

function BooleanCell({ value }: { value: boolean }) {
  return (
    <td className={styles.boolCell}>
      {value ? (
        <>
          <span aria-hidden="true">✓</span>
          <span className={styles.srOnly}>yes</span>
        </>
      ) : (
        <NoValue />
      )}
    </td>
  );
}

function NoValue() {
  return (
    <>
      <span aria-hidden="true">—</span>
      <span className={styles.srOnly}>no</span>
    </>
  );
}

function fabricationServices(rows: MuseBoardRow[]) {
  const services = new Map<string, { name: string; url: string; process: string }>();
  for (const row of rows) {
    for (const part of row.printables) {
      for (const alternative of part.alternatives) {
        for (const service of alternative.services) {
          services.set(`${alternative.process}-${service.name}`, {
            name: service.name,
            url: service.url,
            process: alternative.process,
          });
        }
      }
    }
  }
  return [...services.values()];
}

function formatHumanDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function linkLabel(url: string): string {
  if (url.includes("muse-gadget-sdk")) return "Muse SDK";
  if (url.includes("github.com")) return "Firmware repo";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Docs";
  }
}
