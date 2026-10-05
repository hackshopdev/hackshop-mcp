import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { StartBuildButton } from "@/components/StartBuildButton";
import { pageMetadata } from "@/lib/page-metadata";
import {
  TEMPLATES,
  TEMPLATE_CATEGORIES,
  TEMPLATE_COUNT,
  VERIFIED_TEMPLATE_COUNT,
  type Template,
} from "@/lib/templates";

export const metadata = pageMetadata(
  "Project templates · hackshop-mcp",
  "Verified project templates: idea + recommended hardware + viability assessment. Repurpose old phones, e-readers, Roombas, and DSLRs into useful new things.",
  "/templates",
);

const VIABILITY_LABEL: Record<Template["viability"], string> = {
  verified: "Verified",
  official: "Official SDK",
  iffy: "Works with caveats",
  experimental: "Experimental",
};

const VIABILITY_COLOR: Record<Template["viability"], string> = {
  verified: "var(--ok)",
  official: "var(--ok)",
  iffy: "var(--warn)",
  experimental: "var(--warn)",
};

function ProjectCard({ t }: { t: Template }) {
  return (
    <article
      style={{
        background: "var(--code-bg)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "18px 20px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 8,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 17 }}>{t.title}</h3>
        <span
          style={{
            color: VIABILITY_COLOR[t.viability],
            fontSize: 12,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {VIABILITY_LABEL[t.viability]} · diff {t.difficulty}/5 ·{" "}
          {t.est_cost_usd.min === 0
            ? `~$${t.est_cost_usd.max} or free`
            : t.est_cost_usd.min === t.est_cost_usd.max
              ? `~$${t.est_cost_usd.min}`
              : `$${t.est_cost_usd.min}-${t.est_cost_usd.max}`}{" "}
          {t.est_setup_hours_max
            ? `· ${t.est_setup_hours_min === t.est_setup_hours_max ? `~${t.est_setup_hours_min}h` : `${t.est_setup_hours_min}-${t.est_setup_hours_max}h`} setup`
            : ""}
        </span>
      </div>
      <p style={{ margin: "0 0 10px", fontSize: 15, color: "var(--fg)" }}>
        {t.blurb}
      </p>
      <p
        style={{
          margin: "0 0 14px",
          fontSize: 13,
          color: "var(--muted)",
          lineHeight: 1.5,
        }}
      >
        <strong style={{ color: "var(--fg)" }}>Why this works: </strong>
        {t.viability_note}
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {t.device_id ? (
          <StartBuildButton
            deviceId={t.device_id}
            idea={t.prompt}
            source="template"
            label="Start this build"
            style={{
              minHeight: 40,
              padding: "8px 14px",
              background: "var(--accent)",
              color: "#111",
              border: "1px solid var(--accent)",
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          />
        ) : null}
        <Link
          href={
            t.category === "agents"
              ? `/?idea=${encodeURIComponent(t.prompt)}#start`
              : `/?scout=${encodeURIComponent(t.prompt)}#scout`
          }
          style={{
            display: "inline-flex",
            alignItems: "center",
            minHeight: 40,
            padding: "8px 14px",
            background: t.device_id ? "transparent" : "var(--accent)",
            border: t.device_id ? "1px solid var(--border)" : "1px solid var(--accent)",
            color: t.device_id ? "var(--fg)" : "#111",
            fontSize: 14,
            fontWeight: 600,
            borderRadius: 6,
            textDecoration: "none",
          }}
        >
          {t.category === "agents" ? "Compare boards for this →" : "Try this idea →"}
        </Link>
      </div>
    </article>
  );
}

export default function TemplatesPage() {
  // Group by category
  const byCategory = TEMPLATES.reduce<
    Record<Template["category"], Template[]>
  >(
    (acc, t) => {
      (acc[t.category] ||= []).push(t);
      return acc;
    },
    {} as Record<Template["category"], Template[]>,
  );

  return (
    <>
    <SiteHeader />
    <main>
      <header>
        <h1>Project templates</h1>
        <p className="tagline">
          {TEMPLATE_COUNT} project templates. Each one is a real path. Press
          Start this build to save the parts and steps to My builds, or try the
          idea in the planner.
        </p>
        <ul style={{ margin: "0 0 18px", paddingLeft: 18, color: "var(--muted)", fontSize: 14, lineHeight: 1.7 }}>
          <li>
            <span style={{ color: "var(--ok)" }}>Verified</span>: the hack is documented and reproducible by the community.
          </li>
          <li>
            <span style={{ color: "var(--ok)" }}>Official SDK</span>: the board is supported by the vendor&apos;s own SDK (for example Meta&apos;s Muse Gadgets).
          </li>
          <li>
            <span style={{ color: "var(--warn)" }}>Works with caveats</span>: it works, but read the note first.
          </li>
          <li>
            <span style={{ color: "var(--warn)" }}>Experimental</span>: worth trying; expect to figure some things out.
          </li>
        </ul>
        <div className="badges">
          <Link className="badge" href="/">
            ← Home
          </Link>
          <a className="badge" href="https://github.com/hackshopdev/hackshop-mcp">
            GitHub
          </a>
          <span className="badge">{TEMPLATE_COUNT} templates</span>
          <span className="badge">{VERIFIED_TEMPLATE_COUNT} verified</span>
        </div>
      </header>

      {(Object.keys(TEMPLATE_CATEGORIES) as Template["category"][]).map(
        (cat) => {
          const items = byCategory[cat];
          if (!items || items.length === 0) return null;
          return (
            <section key={cat}>
              <h2>{TEMPLATE_CATEGORIES[cat]}</h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr",
                  gap: 12,
                }}
              >
                {items.map((t) => (
                  <ProjectCard key={t.slug} t={t} />
                ))}
              </div>
            </section>
          );
        },
      )}

      <hr />

      <footer>
        <p>
          Each template is a prompt that the live agent on the homepage can
          process. The agent picks 3-5 hardware candidates from the catalog and
          ranks them with brick risk, firmware links and eBay search links.
        </p>
        <p>
          Missing a project? <a href="https://github.com/hackshopdev/hackshop-mcp/issues">Open an issue</a>{" "}
          and we&apos;ll add it.
        </p>
      </footer>
    </main>
    <SiteFooter />
    </>
  );
}
