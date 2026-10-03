import Link from "next/link";
import { ProjectNav } from "@/components/ProjectNav";
import { StartBuildButton } from "@/components/StartBuildButton";
import { hasImage } from "@/lib/image-sources";
import { getMusePageData, type MuseBoardRow } from "@/lib/muse-page";
import { pageMetadata } from "@/lib/page-metadata";
import { TEMPLATES } from "@/lib/templates";
import styles from "./muse.module.css";

const DESCRIPTION =
  "Which ESP32 boards and Linux boxes work with Meta's Muse Gadgets SDK, what you get on each (voice, images, touch, camera, home-network tunnel), how to build one, the SDK token terms, and free printable stands.";

const IDEA = "Build a Muse gadget for my desk that I can talk to";
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
      <div className={styles.shell}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        <nav className={styles.nav} aria-label="Primary">
          <Link className={styles.brand} href="/">
            Hackshop
          </Link>
          <div className={styles.navLinks}>
            <Link href="/muse">Muse boards</Link>
            <ProjectNav />
            <Link href="/resources">Resources</Link>
          </div>
          <Link className={styles.button} href="/?utm_source=muse&utm_medium=nav">
            Ask the hardware scout
          </Link>
        </nav>

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
            <Link className={styles.button} href={`/?idea=${encodeURIComponent(IDEA)}`}>
              Plan a gadget
            </Link>
            <a className={styles.secondaryButton} href={data.esp32.platform.sdk_repo}>
              Muse Gadgets SDK
            </a>
          </div>
          <p className={styles.verifyLine}>
            Last verified {data.esp32.platform.last_verified} · Sources linked below.
          </p>
        </header>

        <section className={styles.section} aria-labelledby="how-to-start">
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>How to start</p>
            <h2 id="how-to-start">Pick a board, save the build, then hand it off</h2>
          </div>
          <div className={styles.startGrid}>
            {[
              ["1", "Pick a board", "Compare the supported Muse ESP32 and Linux boards below. Not sure? The M5Stack StickS3 is the cheapest Full UI board."],
              ["2", "Start a build", "Each board has a Start a build button. It saves the parts list, print files and a step checklist to My builds."],
              ["3", "Hand it to your agent", "Copy the brief or open the build in Claude, ChatGPT, Codex, Cursor or Muse Code. Order the parts from the store links."],
            ].map(([number, title, body]) => (
              <article className={styles.faqItem} key={number}>
                <span className={styles.smallPill}>{number}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
          <div className={styles.startActions}>
            <Link className={styles.button} href="/build/m5stack-sticks3">
              Start with the StickS3
            </Link>
            <a className={styles.secondaryButton} href="#compare">
              Compare the boards
            </a>
            <Link className={styles.secondaryButton} href="/projects">
              My builds
            </Link>
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
                    <th scope="col">Tier</th>
                    <th scope="col">Voice</th>
                    <th scope="col">Images</th>
                    <th scope="col">Touch</th>
                    <th scope="col">Camera</th>
                    <th scope="col">Air sensors</th>
                    <th scope="col">Home tunnel</th>
                    <th scope="col">Price</th>
                    <th scope="col">Printable</th>
                  </tr>
                </thead>
                <tbody>
                  {data.esp32.boards.map((row) => (
                    <tr key={row.device.id}>
                      <th scope="row">
                        <div>
                          {row.docsUrl ? (
                            <a href={row.docsUrl}>{row.device.name}</a>
                          ) : (
                            row.device.name
                          )}
                        </div>
                        <div className={styles.mutedLine} style={{ marginTop: 4 }}>
                          <Link href={`/build/${row.device.id}`}>Plan →</Link>
                        </div>
                      </th>
                      <td>
                        <TierPill row={row} />
                      </td>
                      <td>{row.voiceLabel ?? <NoValue />}</td>
                      <td>{row.imageLabel ?? <NoValue />}</td>
                      <BooleanCell value={row.board.features.touch === true} />
                      <BooleanCell value={row.board.features.camera === true} />
                      <BooleanCell value={row.board.features.air_sensors === true} />
                      <BooleanCell value={row.board.features.home_tunnel === true} />
                      <td className={styles.priceCell}>{row.priceLabel}</td>
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
        </section>

        <section className={styles.section} aria-labelledby="board-cards">
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>ESP32 boards</p>
            <h2 id="board-cards">Every board in detail</h2>
          </div>
          <BoardGroup title="Full UI" rows={fullUiRows} />
          <BoardGroup title="Status" rows={statusRows} />
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
                    {row.board.note}
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
          <p>Regenerate with your own measurements:</p>
          <pre className={styles.codeBlock}>
            <code>
              python -m hackshop_sim.cad.generate --device &lt;id&gt; --part
              desk-stand --t &lt;mm&gt;
            </code>
          </pre>
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
            <p className={styles.eyebrow}>Start from a prompt</p>
            <h2 id="templates">Templates teaser</h2>
          </div>
          <div className={styles.templateGrid}>
            {museTemplates.map((template) => (
              <Link
                className={styles.templateCard}
                href={`/?idea=${encodeURIComponent(template.prompt)}`}
                key={template.slug}
              >
                <span className={styles.smallPill}>{template.viability}</span>
                <h3>{template.title}</h3>
                <p>{template.blurb}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
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
          <img src={`/api/img?slug=${row.device.id}`} alt={row.device.name} />
        ) : (
          <span>No image</span>
        )}
      </div>
      <div className={styles.cardBody}>
        <div className={styles.cardTop}>
          <h3>{row.device.name}</h3>
          <TierPill row={row} />
        </div>
        <p>{row.device.notes}</p>
        <h4>What works</h4>
        <ul className={styles.workList}>
          {row.whatWorks.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <h4>Build command</h4>
        <pre className={styles.cardCode}>
          <code>{row.board.build}</code>
        </pre>
        <div className={styles.linkRow}>
          <StartBuildButton
            className={styles.button}
            deviceId={row.device.id}
            source="muse_card"
          />
          <Link className={styles.secondaryButton} href={`/build/${row.device.id}`}>
            Build steps
          </Link>
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
                <img src={part.urls.svg} alt={`${row.device.name} printable stand preview`} />
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
          <p className={styles.mutedLine}>{row.fabricationNote}</p>
        )}
      </div>
    </article>
  );
}

function TierPill({ row }: { row: MuseBoardRow }) {
  return (
    <span className={styles.tierWrap}>
      <span className={row.tier === "full-ui" ? styles.fullPill : styles.statusPill}>
        {row.tierLabel}
      </span>
      {row.board.eol ? <span className={styles.eolPill}>EOL</span> : null}
    </span>
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
