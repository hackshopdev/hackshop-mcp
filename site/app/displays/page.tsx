import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { ReverseEngineeringExampleCatalog } from "@/lib/core/reverse-engineering";
import type { Metadata } from "next";
import Link from "next/link";
import examplesJson from "../../reverse-engineering-examples.json";
import styles from "./displays.module.css";

const DESCRIPTION =
  "Affordable screens for calendars, AI interfaces and information panels, with exact models, dated device prices, design starters and primary installation guides.";

export const metadata: Metadata = {
  title: "Cheap displays and design ideas | hackshop",
  description: DESCRIPTION,
  alternates: { canonical: "/displays" },
  openGraph: {
    title: "Cheap displays and design ideas | hackshop",
    description: DESCRIPTION,
    url: "/displays",
    images: ["/opengraph-image"],
  },
  twitter: { card: "summary_large_image", images: ["/opengraph-image"] },
};

const examples = ReverseEngineeringExampleCatalog.parse(examplesJson);
type Example = (typeof examples)[number];

const useCases = [
  {
    id: "calendar",
    label: "Calendars",
    description: "The next appointment, a family schedule or a quiet daily overview.",
  },
  {
    id: "ai_interface",
    label: "AI interfaces",
    description: "A place for an assistant’s replies, progress and useful reminders.",
  },
  {
    id: "info_panel",
    label: "Info panels",
    description: "Weather, transit, room readings and the things you check every day.",
  },
] as const;

const useCaseLabels = {
  calendar: "Calendar",
  ai_interface: "AI interface",
  info_panel: "Info panel",
  smart_home: "Smart home",
  art: "Art",
} as const;

const availabilityLabels = {
  in_stock: "In stock when checked",
  out_of_stock: "Out of stock when checked",
  unknown: "Stock not confirmed",
} as const;

const evidenceLabels: Record<Example["evidence"], string> = {
  reproduced: "Independently reproduced",
  documented: "Public guide or implementation",
  author_demo: "Author demonstration",
  analysis_method: "Research method",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatDollars(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPrice(example: Example) {
  if (!example.price) return "Price not verified";
  const { min_usd: min, max_usd: max } = example.price;
  return min === max ? formatDollars(min) : `${formatDollars(min)}–${formatDollars(max)}`;
}

function affordableFirst(left: Example, right: Example) {
  return (left.price?.min_usd ?? Infinity) - (right.price?.min_usd ?? Infinity)
    || left.device_name.localeCompare(right.device_name);
}

function Price({ example, compact = false }: { example: Example; compact?: boolean }) {
  const price = example.price;

  return (
    <div className={compact ? styles.compactPrice : styles.price}>
      <strong>{formatPrice(example)}</strong>
      {price ? (
        <>
          <span>{price.condition === "used" ? "Used device" : "Device only"}</span>
          <span className={styles.stock} data-stock={price.availability}>
            {availabilityLabels[price.availability]}
          </span>
          <time dateTime={price.checked_at}>Checked {formatDate(price.checked_at)}</time>
          {!compact && price.note && <p className={styles.priceNote}>{price.note}</p>}
          {!compact && (
            <a href={price.source_url} rel="noreferrer" target="_blank">Check seller and variant</a>
          )}
        </>
      ) : (
        <span>Check current supply before choosing this device.</span>
      )}
    </div>
  );
}

function DisplayEntry({ example }: { example: Example }) {
  const ideas = example.design_ideas ?? [];
  const primarySources = example.sources.filter((source) =>
    source.kind === "repo" || source.kind === "guide" || source.kind === "primary_docs",
  );

  return (
    <article className={styles.device} id={example.id} aria-labelledby={`${example.id}-title`}>
      <div className={styles.deviceMain}>
        <header className={styles.deviceHeading}>
          <p>{evidenceLabels[example.evidence]}</p>
          <h3 id={`${example.id}-title`}>{example.device_name}</h3>
        </header>
        <p className={styles.summary}>{example.summary}</p>
        <div className={styles.ideas}>
          {ideas.map((idea) => (
            <div className={styles.idea} key={`${example.id}-${idea.title}`}>
              <span>{useCaseLabels[idea.use_case]}</span>
              <h4>{idea.title}</h4>
              <p>{idea.description}</p>
            </div>
          ))}
        </div>
        <div className={styles.sources} aria-label={`${example.device_name} primary sources`}>
          {primarySources.map((source) => (
            <a key={source.url} href={source.url} rel="noreferrer" target="_blank">
              {source.label}
            </a>
          ))}
          <Link href={`/reverse-engineering#${example.id}`}>Library evidence</Link>
        </div>
      </div>
      <aside className={styles.deviceFacts} aria-label={`${example.device_name} price and compatibility`}>
        <Price example={example} />
        <div className={styles.targets}>
          <h4>Exact hardware</h4>
          {example.exact_models.length ? (
            <ul>{example.exact_models.map((model) => <li key={model}>{model}</li>)}</ul>
          ) : <p>Exact model not published.</p>}
        </div>
        {example.warnings.length > 0 && (
          <details className={styles.notes}>
            <summary>Compatibility and setup notes</summary>
            <ul>{example.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
          </details>
        )}
      </aside>
    </article>
  );
}

export default function DisplaysPage() {
  const displays = examples.filter((example) =>
    example.category === "display" && (example.design_ideas?.length ?? 0) > 0,
  ).sort(affordableFirst);

  return (
    <main className={styles.page}>
      <SiteHeader cta={{ label: "Start a build", href: "/#start" }} />
      <div className={styles.shell}>
        <header className={styles.hero}>
          <h1>Put a useful screen anywhere.</h1>
          <p>
            Cheap displays and reclaimed devices for calendars, assistants and everyday information.
            Choose the screen, then start with a design that fits what it can actually do.
          </p>
          <div className={styles.heroLinks}>
            <a href="#comparison">Compare device prices</a>
            <a href="#designs">Explore design starters</a>
            <Link href="/reverse-engineering">Browse all hardware hacks</Link>
          </div>
        </header>

        <section className={styles.useCases} aria-labelledby="use-cases-title">
          <h2 id="use-cases-title">What would you like to see?</h2>
          <div className={styles.useCaseList}>
            {useCases.map((useCase) => {
              const matches = displays.filter((example) =>
                example.design_ideas?.some((idea) => idea.use_case === useCase.id),
              );
              return (
                <div className={styles.useCase} key={useCase.id}>
                  <h3>{useCase.label}</h3>
                  <p>{useCase.description}</p>
                  {matches.length > 0 && (
                    <ul>
                      {matches.slice(0, 3).map((example) => (
                        <li key={example.id}><a href={`#${example.id}`}>{example.device_name}</a></li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className={styles.comparison} id="comparison" aria-labelledby="comparison-title">
          <header className={styles.sectionHeading}>
            <h2 id="comparison-title">Compare the screens</h2>
            <p>Known device prices come first. Enclosures, cables and extra parts are described with each device.</p>
          </header>
          {displays.length ? (
            <div
              className={styles.tableWrap}
              role="region"
              aria-labelledby="comparison-title"
              tabIndex={0}
            >
              <table className={styles.table}>
                <caption className="sr-only">Displays sorted by the lowest verified device price, with unverified prices last.</caption>
                <thead><tr><th scope="col">Device</th><th scope="col">Device price</th><th scope="col">Screen and role</th><th scope="col">Design starters</th></tr></thead>
                <tbody>
                  {displays.map((example) => (
                    <tr key={example.id}>
                      <th scope="row"><a href={`#${example.id}`}>{example.device_name}</a></th>
                      <td><Price example={example} compact /></td>
                      <td className={styles.screenDescription}>{example.summary}</td>
                      <td>
                        <ul className={styles.designTypes}>
                          {[...new Set(example.design_ideas?.map((idea) => idea.use_case))].map((useCase) => (
                            <li key={useCase}>{useCaseLabels[useCase]}</li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className={styles.empty}>Display designs are being added. Explore the source-linked <Link href="/reverse-engineering">hardware library</Link> in the meantime.</p>}
        </section>

        <aside className={styles.aiNote}>
          <h2>A small screen can be an AI interface.</h2>
          <p>
            For the microcontroller displays here, build a small interface that receives text or images from an AI
            service. A calendar can arrive as a bitmap; a status panel can read a simple feed. Browser dashboards
            belong on devices with a browser. The design starters describe an interface, not a local language model.
          </p>
        </aside>

        <section className={styles.designs} id="designs" aria-labelledby="designs-title">
          <header className={styles.sectionHeading}>
            <h2 id="designs-title">Start with the device you choose</h2>
            <p>These are design directions to build from. Follow the linked implementation and match the exact hardware before setup.</p>
          </header>
          {displays.map((example) => <DisplayEntry example={example} key={example.id} />)}
        </section>

        <p className={styles.closingNote}>
          Prices are dated observations, not a checkout total. Each source remains the authority for its model,
          installation and recovery instructions. <Link href="/reverse-engineering">See the full evidence library.</Link>
        </p>
      </div>
      <SiteFooter />
    </main>
  );
}
