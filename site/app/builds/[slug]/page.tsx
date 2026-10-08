import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { StartBuildButton } from "@/components/StartBuildButton";
import { SeeInside } from "@/components/exploded/SeeInside";
import ui from "@/components/ui.module.css";
import { buildPlanForDevice } from "@/lib/build-plan-data";
import {
  embodimentRecipe,
  embodimentRecipeSlugs,
  type EmbodimentCapability,
  type RecipeAcceptanceCheck,
} from "@/lib/embodiment-recipes";
import { pageMetadata } from "@/lib/page-metadata";
import styles from "./recipe.module.css";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return embodimentRecipeSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const recipe = embodimentRecipe(slug);
  if (!recipe) return {};
  return pageMetadata(`${recipe.title} · complete build recipe · Hackshop`, recipe.dek, `/builds/${slug}`);
}

export default async function EmbodimentRecipePage({ params }: Props) {
  const { slug } = await params;
  const recipe = embodimentRecipe(slug);
  if (!recipe) notFound();
  const plan = buildPlanForDevice(recipe.device_id);
  if (!plan) notFound();

  return (
    <main className={ui.page}>
      <SiteHeader cta={null} />
      <div className={ui.shell}>
        <p className={styles.crumbs}>
          <Link href="/templates">Build recipes</Link> / {recipe.title}
        </p>

        <section className={styles.hero}>
          <div>
            <div className={ui.pillRow}>
              <span className={ui.pillAccent}>Muse / open platform</span>
              <span className={ui.pillWarn}>Concept — physical build pending</span>
              <span className={ui.pill}>Recipe {recipe.version}</span>
            </div>
            <h1>{recipe.title}</h1>
            <p className={styles.dek}>{recipe.dek}</p>
            <div className={styles.facts}>
              <span>
                <strong>${recipe.price.min_usd.toFixed(2)}–${recipe.price.max_usd.toFixed(2)}</strong>
                <small>parts estimate</small>
              </span>
              <span>
                <strong>{plan.est_time_label ?? "1–3 hours"}</strong>
                <small>first build</small>
              </span>
              <span>
                <strong>{recipe.capabilities.length}</strong>
                <small>senses + actions mapped</small>
              </span>
            </div>
            <div className={ui.actions}>
              <StartBuildButton
                className={ui.btnPrimary}
                deviceId={recipe.device_id}
                source="embodiment_recipe"
                label="Save this build"
              />
              <Link className={ui.btnSecondary} href={`/build/${recipe.device_id}`}>
                Open live checklist
              </Link>
            </div>
          </div>

          <aside className={styles.firstSuccess}>
            <p className={ui.eyebrow}>First success</p>
            <p>{recipe.first_success}</p>
            <small>Prove this before adding TTS, automations or extra devices.</small>
          </aside>
        </section>

        <section className={ui.section} aria-labelledby="proof">
          <div className={ui.sectionHead}>
            <p className={ui.eyebrow}>Build proof</p>
            <h2 id="proof">See the whole build before touching the board</h2>
            <p>
              This clip explains the intended interaction. It is a concept animation, not footage of a verified
              physical build. The interactive model below distinguishes official CAD and published dimensions from
              clearly labeled schematic accessories.
            </p>
          </div>
          <div className={styles.proofGrid}>
            <div className={styles.videoCard}>
              <video
                controls
                playsInline
                preload="metadata"
                poster={`/${recipe.proof.demo_video?.poster_href}`}
                aria-label={`${recipe.title} concept animation`}
              >
                <source src={`/${recipe.proof.demo_video?.href}`} type="video/mp4" />
              </video>
              <div className={styles.proofCaption}>
                <strong>{Math.round(recipe.proof.demo_video?.duration_seconds ?? 0)}-second 3D build tour</strong>
                <span>No real hardware is shown.</span>
              </div>
            </div>
            <div className={styles.proofState}>
              <ProofRow label="Interactive build" value="Available" state="ready" />
              <ProofRow label="Quick video" value="Concept animation" state="concept" />
              <ProofRow label="Finished-build photo" value="Not built yet" state="missing" />
              <ProofRow label="Verified community uploads" value="0 reviewed" state="missing" />
              <p>{recipe.community_builds.note}</p>
            </div>
          </div>
        </section>

        <div id="interactive-build" className={styles.anchor}>
          <SeeInside
            deviceId={recipe.device_id}
            name={recipe.title.replace(/^A\s+/i, "")}
            variant="recipe"
          />
        </div>

        <section className={ui.section} aria-labelledby="capabilities">
          <div className={ui.sectionHead}>
            <p className={ui.eyebrow}>Senses and actions</p>
            <h2 id="capabilities">What this body gives the agent</h2>
            <p>Capabilities are labeled at the integration boundary, so a speaker is not mistaken for working TTS.</p>
          </div>
          <div className={styles.capabilityGrid}>
            {recipe.capabilities.map((capability) => (
              <CapabilityCard capability={capability} key={capability.id} />
            ))}
          </div>
        </section>

        <section className={ui.section} aria-labelledby="parts">
          <div className={ui.sectionHead}>
            <p className={ui.eyebrow}>Parts</p>
            <h2 id="parts">Everything in this version</h2>
            <p>
              Prices were checked {recipe.price.checked_at}. Hackshop opens seller links but never places an order.
            </p>
          </div>
          <div className={styles.partsList}>
            {plan.parts.map((part) => {
              const url = part.buy_url ?? part.search_url ?? part.info_url;
              return (
                <article className={styles.part} key={part.id}>
                  <span className={styles.partQty}>{part.qty}×</span>
                  <div>
                    <h3>{part.name}</h3>
                    <p>{part.note}</p>
                    <span>{part.required ? "Required" : "Optional"}{part.est_price_usd != null ? ` · $${part.est_price_usd.toFixed(2)}` : ""}</span>
                  </div>
                  {url ? (
                    <a href={url} target="_blank" rel="noreferrer">
                      {part.kind === "printed" ? "Download" : "Check source"} ↗
                    </a>
                  ) : null}
                </article>
              );
            })}
          </div>
          <p className={styles.priceNote}>{recipe.price.note}</p>
        </section>

        <section className={ui.section} aria-labelledby="build-steps">
          <div className={ui.sectionHead}>
            <p className={ui.eyebrow}>How to build it</p>
            <h2 id="build-steps">From unopened parts to first conversation</h2>
            <p>The commands and recovery path are generated from the same machine-readable plan your agent receives.</p>
          </div>
          <ol className={styles.steps}>
            {plan.steps.map((step, index) => (
              <li key={step.id}>
                <span className={styles.stepNumber}>{String(index + 1).padStart(2, "0")}</span>
                <div className={styles.stepBody}>
                  <h3>{step.title}</h3>
                  <p className={styles.why}>{step.why}</p>
                  <div className={styles.body}>
                    <ReactMarkdown>{step.body_md}</ReactMarkdown>
                  </div>
                  {step.commands.map((command) => (
                    <pre className={ui.codeBox} key={command}>
                      <code>{command}</code>
                    </pre>
                  ))}
                  {step.links.length > 0 ? (
                    <div className={styles.stepLinks}>
                      {step.links.map((link) => (
                        <a href={link.url} key={link.url} target="_blank" rel="noreferrer">
                          {link.label} ↗
                        </a>
                      ))}
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className={ui.section} aria-labelledby="checks">
          <div className={ui.sectionHead}>
            <p className={ui.eyebrow}>Acceptance checks</p>
            <h2 id="checks">How we know the build actually works</h2>
            <p>A flash that exits successfully is not enough; the final checks happen on the real device.</p>
          </div>
          <div className={styles.checks}>
            {recipe.acceptance_checks.map((check, index) => (
              <AcceptanceCheck check={check} index={index} key={check.id} />
            ))}
          </div>
        </section>

        <section className={`${ui.section} ${styles.cautions}`} aria-labelledby="limits">
          <div>
            <p className={ui.eyebrow}>Before you build</p>
            <h2 id="limits">Limits, recovery and terms</h2>
          </div>
          <div>
            <ul>
              {[...plan.warnings, ...recipe.limits].map((limit) => (
                <li key={limit}>{limit}</li>
              ))}
            </ul>
            {plan.flash?.recovery ? (
              <p className={styles.recovery}>
                <strong>If flashing fails:</strong> {plan.flash.recovery}
              </p>
            ) : null}
            {plan.terms ? (
              <a href={plan.terms.url} target="_blank" rel="noreferrer">
                Read the current Muse SDK terms ↗
              </a>
            ) : null}
          </div>
        </section>

        <section className={`${ui.section} ${styles.sources}`} aria-labelledby="sources">
          <div className={ui.sectionHead}>
            <p className={ui.eyebrow}>Source trail</p>
            <h2 id="sources">What this recipe was checked against</h2>
            <p>
              SDK commit <code>{recipe.software.sdk_commit.slice(0, 12)}</code> · ESP-IDF {recipe.software.esp_idf} · reviewed {recipe.reviewed_at}
            </p>
          </div>
          <ol>
            {recipe.sources.map((source) => (
              <li key={source.url}>
                <a href={source.url} target="_blank" rel="noreferrer">{source.label} ↗</a>
              </li>
            ))}
          </ol>
        </section>
      </div>
      <SiteFooter />
    </main>
  );
}

function CapabilityCard({ capability }: { capability: EmbodimentCapability }) {
  return (
    <article className={styles.capability}>
      <span className={styles.capabilityDirection}>{capability.direction}</span>
      <h3>{capability.label}</h3>
      <span className={capability.support === "supported" ? styles.supported : styles.integration}>
        {capability.support === "supported" ? "Works in this build" : "Needs integration"}
      </span>
      <p>{capability.note}</p>
    </article>
  );
}

function ProofRow({ label, value, state }: { label: string; value: string; state: "ready" | "concept" | "missing" }) {
  return (
    <div className={styles.proofRow}>
      <span>{label}</span>
      <strong data-state={state}>{value}</strong>
    </div>
  );
}

function AcceptanceCheck({ check, index }: { check: RecipeAcceptanceCheck; index: number }) {
  return (
    <article className={styles.check}>
      <span>{index + 1}</span>
      <div>
        <p className={styles.evidence}>{check.evidence.replace("-", " ")}</p>
        <h3>{check.label}</h3>
        <p>{check.expect}</p>
        {check.command ? <code>{check.command}</code> : null}
      </div>
    </article>
  );
}
