import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { ReverseEngineeringExampleCatalog } from "@/lib/core/reverse-engineering";
import examplesJson from "../../reverse-engineering-examples.json";
import type { Metadata } from "next";
import Link from "next/link";
import styles from "./reverse-engineering.module.css";

const DESCRIPTION =
  "A source-linked library of current hardware reverse-engineering projects, exact device targets, recovery warnings, author demos and reusable analysis methods.";

export const metadata: Metadata = {
  title: "Reverse engineering library | hackshop",
  description: DESCRIPTION,
  alternates: { canonical: "/reverse-engineering" },
  openGraph: {
    title: "Reverse engineering library | hackshop",
    description: DESCRIPTION,
    url: "/reverse-engineering",
    images: ["/opengraph-image"],
  },
  twitter: { card: "summary_large_image", images: ["/opengraph-image"] },
};

const examples = ReverseEngineeringExampleCatalog.parse(examplesJson);
type Example = (typeof examples)[number];

const evidenceLabels: Record<Example["evidence"], string> = {
  reproduced: "Independently reproduced",
  documented: "Documented build",
  author_demo: "Author demo",
  analysis_method: "Analysis method",
};

const methodLabels: Record<Example["method"], string> = {
  root: "Root access",
  firmware: "Firmware",
  protocol: "Local protocol",
  app_api: "App / cloud API",
  hardware_bus: "Hardware bus",
  repurpose: "Repurpose",
  analysis_tool: "Analysis tool",
};

function newestFirst(left: Example, right: Example) {
  return (right.published_at ?? "").localeCompare(left.published_at ?? "") || left.title.localeCompare(right.title);
}

function formatDate(value?: string) {
  if (!value) return "Date not published";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function EvidenceRow({ example }: { example: Example }) {
  return (
    <article id={example.id} className={`${styles.entry} ${styles[example.evidence]}`}>
      <span className={styles.node} aria-hidden="true" />
      <div className={styles.story}>
        <div className={styles.entryMeta}>
          <span className={styles.status}>{evidenceLabels[example.evidence]}</span>
          <time dateTime={example.published_at}>{formatDate(example.published_at)}</time>
        </div>
        <h3>{example.title}</h3>
        <p className={styles.device}>{example.device_name}</p>
        <p className={styles.summary}>{example.summary}</p>
        <p className={styles.outcome}>
          <strong>Outcome</strong>
          {example.outcome}
        </p>
        <div className={styles.sources} aria-label="Sources">
          {example.sources.map((source) => (
            <a href={source.url} key={`${example.id}-${source.url}`} rel="noreferrer" target="_blank">
              {source.label}
              <span aria-hidden="true">↗</span>
            </a>
          ))}
        </div>
      </div>
      <aside className={styles.facts} aria-label={`${example.title} compatibility and risk`}>
        <div>
          <span className={styles.factLabel}>Exact target</span>
          {example.exact_models.length > 0 ? (
            <ul className={styles.models}>
              {example.exact_models.map((model) => <li key={model}>{model}</li>)}
            </ul>
          ) : (
            <p className={styles.unknown}>Not published</p>
          )}
        </div>
        <div className={styles.compactFacts}>
          <p><span>Method</span>{methodLabels[example.method]}</p>
          <p><span>Risk</span><b data-risk={example.risk_level}>{example.risk_level}</b></p>
          <p><span>Repeatability</span>{example.reproducibility.replace("_", " ")}</p>
        </div>
        {example.warnings.length > 0 && (
          <details className={styles.warnings}>
            <summary>{example.warnings.length} compatibility &amp; safety note{example.warnings.length === 1 ? "" : "s"}</summary>
            <ul>
              {example.warnings.map((warning) => <li key={warning}>{warning}</li>)}
            </ul>
          </details>
        )}
      </aside>
    </article>
  );
}

function EvidenceSection({
  id,
  title,
  description,
  entries,
}: {
  id: string;
  title: string;
  description: string;
  entries: Example[];
}) {
  return (
    <section className={styles.section} id={id} aria-labelledby={`${id}-title`}>
      <header className={styles.sectionHead}>
        <div>
          <p>{String(entries.length).padStart(2, "0")} entries</p>
          <h2 id={`${id}-title`}>{title}</h2>
        </div>
        <p>{description}</p>
      </header>
      <div className={styles.timeline}>
        {entries.map((example) => <EvidenceRow example={example} key={example.id} />)}
      </div>
    </section>
  );
}

export default function ReverseEngineeringPage() {
  const builds = examples
    .filter((example) => example.evidence === "reproduced" || example.evidence === "documented")
    .sort(newestFirst);
  const demos = examples.filter((example) => example.evidence === "author_demo").sort(newestFirst);
  const methods = examples.filter((example) => example.evidence === "analysis_method").sort(newestFirst);

  return (
    <main className={styles.page}>
      <SiteHeader cta={{ label: "Start a build", href: "/#start" }} />
      <div className={styles.shell}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>The hardware field notebook</p>
          <h1>What people are actually hacking right now.</h1>
          <p className={styles.lede}>
            Source-linked projects for reclaiming displays, speakers, appliances and abandoned hubs. Every entry says
            what was really tested, which exact model it applies to, and where the dangerous assumptions begin.
          </p>
          <div className={styles.indexLine}>
            <span>{examples.length} curated entries</span>
            <a href="#builds">Documented builds</a>
            <a href="#demos">Author demos</a>
            <a href="#methods">Analysis methods</a>
            <Link href="/displays">Cheap display designs</Link>
          </div>
        </header>

        <section className={styles.readingKey} aria-labelledby="evidence-key">
          <div>
            <p className={styles.keyLabel} id="evidence-key">Read the evidence, not the vibe</p>
            <p>
              A demo is useful inspiration. It is not a compatibility promise. “Documented” means there is an
              inspectable implementation or guide; only “independently reproduced” cites a separate reproduction.
            </p>
          </div>
          <dl>
            <div><dt data-kind="reproduced">Reproduced</dt><dd>Independent build cited</dd></div>
            <div><dt data-kind="documented">Documented</dt><dd>Inspectable repo or guide</dd></div>
            <div><dt data-kind="author_demo">Demo</dt><dd>Author-reported result</dd></div>
            <div><dt data-kind="analysis_method">Method</dt><dd>Saved evidence or analysis tool</dd></div>
          </dl>
        </section>

        <aside className={styles.fieldNote}>
          <span>FIELD NOTE / 2026-10-14</span>
          <p>
            The two $50 photo frames sold under one Amazon listing contain incompatible Rockchip and Allwinner boards.
            They stay separate here. REA&apos;s public showcase contains software cases—not hardware—but its corpus does
            contain three hardware artifacts: an Archer C7 image, a Wii Nunchuk I²C capture and a MAX3232E UART capture.
          </p>
        </aside>

        <EvidenceSection
          id="builds"
          title="Documented builds"
          description="Projects with a public implementation or guide. Exact targets and recovery notes still outrank popularity, stars or a polished video."
          entries={builds}
        />
        <EvidenceSection
          id="demos"
          title="Author demos"
          description="Interesting interfaces shown against real hardware, but without enough model, protocol or recovery detail to hand to another builder yet."
          entries={demos}
        />
        <EvidenceSection
          id="methods"
          title="Analysis methods"
          description="Saved firmware and signal evidence you can inspect reproducibly. These records deliberately do not claim physical acquisition, flashing or runtime proof."
          entries={methods}
        />

        <footer className={styles.updateNote}>
          Checked October 14, 2026. Sources are linked per entry. For agent access, use the MCP tool{` `}
          <code>find_reverse_engineering_examples</code> or read <code>hackshop://reverse-engineering/examples</code>.
        </footer>
      </div>
      <SiteFooter />
    </main>
  );
}
