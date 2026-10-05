import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/CopyButton";
import { DifficultyBadge } from "@/components/DifficultyBadge";
import { ProductTile } from "@/components/ProductTile";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { StartBuildButton } from "@/components/StartBuildButton";
import { TellMyAgent } from "@/components/TellMyAgent";
import ui from "@/components/ui.module.css";
import { ASK_AGENT_TITLE, buildWithAgentPrompt, SITE_URL } from "@/lib/agent-prompts";
import { allBoardSlugs, boardPath, deviceIdForSlug } from "@/lib/board-slugs";
import { hasImage } from "@/lib/image-sources";
import { buildPlanForDevice } from "@/lib/build-plan-data";
import { getMusePageData, type MuseBoardRow } from "@/lib/muse-page";
import { pageMetadata } from "@/lib/page-metadata";
import { difficultyFor } from "@/lib/ui/difficulty";
import { hasDeveloperDetail, humanNote, plainTierLabel } from "@/lib/ui/labels";
import { boardAndTotalLabel } from "@/lib/ui/price";
import styles from "./board.module.css";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return allBoardSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const found = findRow(slug);
  if (!found) return {};
  const { row } = found;
  return pageMetadata(
    `${row.device.name} for Muse: what it can do and how to build it · Hackshop`,
    `${row.device.name} (${row.priceLabel}) as a Muse gadget: features, parts, printable stand, build command and a step-by-step build you can hand to your agent.`,
    `/muse/${slug}`,
  );
}

export default async function BoardPage({ params }: Props) {
  const { slug } = await params;
  const found = findRow(slug);
  if (!found) notFound();
  const { row, platformName, siblings } = found;
  const plan = buildPlanForDevice(row.device.id);
  const features = featureRows(row);
  const compare = closestByPrice(row, siblings).slice(0, 3);
  const buyUrl = row.device.buy_url ?? null;
  const difficulty = difficultyFor(row.device.id);
  const priceLine = boardAndTotalLabel(row.priceLabel, plan?.shopping_list.est_total_usd ?? null);
  const summary = humanNote(row.device.notes);
  const boardNote = humanNote(row.board.note);
  const devNotes = [row.device.notes, row.board.note].filter((note) => hasDeveloperDetail(note));
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Muse gadgets", item: `${SITE_URL}/muse` },
      { "@type": "ListItem", position: 2, name: row.device.name, item: `${SITE_URL}/muse/${slug}` },
    ],
  };

  return (
    <main className={ui.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader />
      <div className={ui.shell}>
        <p className={styles.crumbs}>
          <Link href="/muse">Muse gadgets</Link> / {row.device.name}
        </p>

        <section className={styles.hero}>
          <ProductTile deviceId={row.device.id} name={row.device.name} priority hasPhoto={hasImage(row.device.id)} className={styles.heroTile} />
          <div className={styles.heroCopy}>
            <div className={ui.pillRow}>
              <span className={row.tier === "full-ui" ? ui.pillAccent : ui.pill}>{plainTierLabel(row.tier) ?? row.tierLabel}</span>
              <span className={ui.pill}>
                {row.board.support === "official" ? "Officially supported" : "Community path"}
              </span>
              <span className={ui.pill}>{platformName}</span>
              {row.board.eol ? <span className={ui.pillWarn}>End of life</span> : null}
            </div>
            <h1>{row.device.name}</h1>
            <p className={styles.price}>{priceLine ?? row.priceLabel}</p>
            {difficulty ? (
              <div className={styles.difficulty}>
                <DifficultyBadge difficulty={difficulty} showWhy />
              </div>
            ) : null}
            <p className={styles.summary}>{summary || boardNote}</p>
            <div className={ui.actions}>
              <StartBuildButton className={ui.btnPrimary} deviceId={row.device.id} source="board_page" />
              <TellMyAgent
                prompt={buildWithAgentPrompt({ name: row.device.name, deviceId: row.device.id })}
                surface="board_page"
                label={ASK_AGENT_TITLE}
              />
            </div>
            <div className={styles.secondaryLinks}>
              <Link className={ui.linkArrow} href={`/build/${row.device.id}`}>
                See the build steps
              </Link>
              {buyUrl ? (
                <a className={ui.linkArrow} href={buyUrl} target="_blank" rel="noreferrer">
                  Buy from {hostOf(buyUrl)}
                </a>
              ) : null}
              <Link className={ui.linkArrow} href={`/store#${slug}`}>
                Compare prices, new and used
              </Link>
            </div>
          </div>
        </section>

        <div className={styles.columns}>
          <section className={ui.card} aria-labelledby="can-do">
            <h2 id="can-do" className={styles.h2}>What it can do</h2>
            <ul className={styles.features}>
              {features.map((feature) => (
                <li key={feature.label} className={feature.value ? styles.yes : styles.no}>
                  <span aria-hidden="true">{feature.value ? "✓" : "—"}</span>
                  <span>
                    {feature.label}
                    {feature.detail ? <em> · {feature.detail}</em> : null}
                  </span>
                  <span className={ui.srOnly}>{feature.value ? "yes" : "no"}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className={ui.card} aria-labelledby="say">
            <h2 id="say" className={styles.h2}>Things to say to it</h2>
            {plan && plan.try_saying.length > 0 ? (
              <div className={styles.quotes}>
                {plan.try_saying.map((line) => (
                  <span className={styles.quote} key={line}>
                    “{line}”
                  </span>
                ))}
              </div>
            ) : (
              <p className={ui.muted}>Ask Muse anything once it&apos;s paired.</p>
            )}
            {plan ? (
              <>
                <h2 className={styles.h2} style={{ marginTop: 24 }}>
                  What you need
                </h2>
                <ul className={styles.parts}>
                  {plan.parts.map((part) => {
                    const url = part.buy_url ?? part.search_url;
                    return (
                      <li key={part.id}>
                        <span>
                          {part.qty} × {part.name}
                          {part.required ? "" : <em> (optional)</em>}
                        </span>
                        {url ? (
                          <a href={url} target="_blank" rel="noreferrer">
                            {part.buy_url ? "Buy" : "Find"}
                          </a>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : null}
          </section>
        </div>

        {row.printables.length > 0 ? (
          <section className={ui.section} aria-labelledby="stand">
            <div className={ui.sectionHead}>
              <p className={ui.eyebrow}>Printable stand</p>
              <h2 id="stand">Print it, or get it made</h2>
              <p>STL for printing, STEP for CAD, and a fab.json with print settings and fit checks.</p>
            </div>
            {row.printables.map((part) => (
              <div className={styles.stand} key={part.urls.fab}>
                <div className={styles.standPreview}>
                  <img
                    src={part.urls.svg}
                    alt={`${row.device.name} printable stand preview`}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <div>
                  <h3>{part.title}</h3>
                  <p className={ui.muted}>
                    {[part.bboxLabel, part.estimatedMassLabel].filter(Boolean).join(" · ")}
                  </p>
                  <div className={ui.actions}>
                    <a className={`${ui.btnSecondary} ${ui.btnSmall}`} href={part.urls.stl}>
                      STL
                    </a>
                    <a className={`${ui.btnSecondary} ${ui.btnSmall}`} href={part.urls.step}>
                      STEP
                    </a>
                    <a className={`${ui.btnSecondary} ${ui.btnSmall}`} href={part.urls.fab}>
                      fab.json
                    </a>
                  </div>
                  {part.caveat ? <p className={styles.caveat}>{part.caveat}</p> : null}
                </div>
              </div>
            ))}
          </section>
        ) : null}

        <section className={ui.section} aria-labelledby="dev-details">
          <details className={styles.devDetails}>
            <summary>
              <span id="dev-details">Developer details</span>
              <span className={ui.muted}> · build command and SDK notes</span>
            </summary>
            <p className={ui.muted}>
              Your coding agent runs this for you. The full sequence (token, flash, pair) is on the{" "}
              <Link className={ui.linkArrow} href={`/build/${row.device.id}`}>
                build page
              </Link>
              .
            </p>
            {devNotes.map((note) => (
              <p className={styles.devNote} key={note}>
                {note}
              </p>
            ))}
            <pre className={ui.codeBox}>
              <code>{row.board.build}</code>
            </pre>
            <div style={{ marginTop: 10 }}>
              <CopyButton className={`${ui.btnSecondary} ${ui.btnSmall}`} text={row.board.build} label="Copy command" />
            </div>
          </details>
        </section>

        {plan && plan.caveats.length > 0 ? (
          <section className={ui.section} aria-labelledby="good-to-know">
            <div className={ui.sectionHead}>
              <p className={ui.eyebrow}>Limits</p>
              <h2 id="good-to-know">Good to know</h2>
            </div>
            <ul className={styles.caveats}>
              {plan.caveats.map((caveat) => (
                <li key={caveat}>{caveat}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {compare.length > 0 ? (
          <section className={ui.section} aria-labelledby="compare-with">
            <div className={ui.sectionHead}>
              <p className={ui.eyebrow}>Alternatives</p>
              <h2 id="compare-with">Compare with</h2>
            </div>
            <div className={ui.grid3}>
              {compare.map((other) => (
                <Link
                  key={other.device.id}
                  href={boardPath(other.device.id) ?? `/build/${other.device.id}`}
                  className={styles.compareCard}
                >
                  <ProductTile deviceId={other.device.id} name={other.device.name} hasPhoto={hasImage(other.device.id)} />
                  <strong>{other.device.name}</strong>
                  <span className={ui.muted}>
                    {plainTierLabel(other.tier) ?? other.tierLabel} · {other.priceLabel}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section className={ui.section} aria-labelledby="sources">
          <div className={ui.sectionHead}>
            <p className={ui.eyebrow}>Primary links</p>
            <h2 id="sources">Sources</h2>
          </div>
          <ul className={styles.sources}>
            {[...new Set([...row.device.firmware_links, row.device.physical?.source_url].filter(Boolean) as string[])].map(
              (link) => (
                <li key={link}>
                  <a href={link}>{link}</a>
                </li>
              ),
            )}
          </ul>
        </section>
      </div>
      <SiteFooter />
    </main>
  );
}

function findRow(slug: string) {
  const deviceId = deviceIdForSlug(slug);
  if (!deviceId) return null;
  const data = getMusePageData();
  const esp32 = data.esp32.boards;
  const linux = [...data.linux.officialBoards, ...data.linux.possibleBoards];
  const inEsp32 = esp32.find((row) => row.device.id === deviceId);
  if (inEsp32) {
    return { row: inEsp32, platformName: "ESP32 SDK", siblings: esp32 };
  }
  const inLinux = linux.find((row) => row.device.id === deviceId);
  if (inLinux) {
    return { row: inLinux, platformName: "Linux SDK", siblings: data.linux.officialBoards };
  }
  return null;
}

function featureRows(row: MuseBoardRow) {
  const f = row.board.features;
  const isLinux = f.compute !== undefined;
  if (isLinux) {
    return [
      { label: "Shell, files and health commands", value: true, detail: null },
      { label: "Messages back to you", value: true, detail: null },
      { label: "Bluetooth LE built in", value: f.ble_builtin === true, detail: f.ble_builtin === true ? null : "add a USB adapter" },
      { label: "Server workloads", value: f.compute === "standard" || f.compute === "desktop", detail: typeof f.compute === "string" ? `${f.compute} compute` : null },
    ];
  }
  return [
    { label: "Voice", value: row.voiceLabel !== null, detail: row.voiceLabel },
    { label: "Images", value: row.imageLabel !== null, detail: row.imageLabel },
    { label: "Touchscreen", value: f.touch === true, detail: null },
    { label: "Camera", value: f.camera === true, detail: null },
    { label: "Air sensors", value: f.air_sensors === true, detail: null },
    { label: "Home-network tunnel", value: f.home_tunnel === true, detail: null },
    { label: "Battery", value: f.battery === "yes" || f.battery === "optional", detail: f.battery === "optional" ? "optional" : null },
    { label: "Over-the-air updates", value: f.ota === true, detail: null },
  ];
}

function closestByPrice(row: MuseBoardRow, siblings: MuseBoardRow[]): MuseBoardRow[] {
  const price = row.device.est_used_price_usd_min ?? 0;
  return siblings
    .filter((other) => other.device.id !== row.device.id && boardPath(other.device.id))
    .sort(
      (a, b) =>
        Math.abs((a.device.est_used_price_usd_min ?? 0) - price) -
        Math.abs((b.device.est_used_price_usd_min ?? 0) - price),
    );
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "the store";
  }
}
