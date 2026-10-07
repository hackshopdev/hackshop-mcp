import Link from "next/link";
import { AgentConnect } from "@/components/AgentConnect";
import { DemoForm } from "@/components/DemoForm";
import { GadgetPlanner } from "@/components/GadgetPlanner";
import { ProductTile } from "@/components/ProductTile";
import { SiteFooter } from "@/components/SiteFooter";
import { TopIdeas } from "@/components/ideas/TopIdeas";
import { SiteHeader } from "@/components/SiteHeader";
import { StartBuildButton } from "@/components/StartBuildButton";
import { TellMyAgent } from "@/components/TellMyAgent";
import ui from "@/components/ui.module.css";
import { GENERAL_AGENT_PROMPT } from "@/lib/agent-prompts";
import { hasImage } from "@/lib/image-sources";
import { boardPath } from "@/lib/board-slugs";
import { getMusePageData, type MuseBoardRow } from "@/lib/muse-page";
import { TEMPLATES } from "@/lib/templates";
import { embodimentRecipe } from "@/lib/embodiment-recipes";
import { difficultyMap } from "@/lib/ui/difficulty";
import { plainTierLabel } from "@/lib/ui/labels";
import styles from "./home.module.css";

export const dynamic = "force-static";
// Refresh the top ideas strip every five minutes.
export const revalidate = 300;

const HERO_BOARDS: Array<{ id: string; caption: string }> = [
  { id: "m5stack-sticks3", caption: "Pocket voice remote" },
  { id: "waveshare-esp32-s3-touch-amoled-1-75c", caption: "Round desk display" },
  { id: "seeed-sensecap-indicator", caption: "Air-quality screen" },
];

export default function Home() {
  const data = getMusePageData();
  const esp32 = data.esp32.boards;
  const pi5 = data.linux.officialBoards.find((row) => row.device.id === "raspberry-pi-5");
  const boardGrid = pi5 ? [...esp32, pi5] : esp32;
  const rowsById = new Map([...esp32, ...data.linux.officialBoards].map((row) => [row.device.id, row]));
  const heroRows = HERO_BOARDS.map((board) => ({ ...board, row: rowsById.get(board.id) })).filter(
    (board): board is { id: string; caption: string; row: MuseBoardRow } => Boolean(board.row),
  );
  const museTemplates = TEMPLATES.filter((template) => template.category === "agents");
  const cheapest = Math.min(
    ...esp32.map((row) => row.device.est_used_price_usd_min ?? Number.POSITIVE_INFINITY),
  );
  const faq = homeFaq(Number.isFinite(cheapest) ? cheapest : 10, esp32.length);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: { "@type": "Answer", text: entry.answer },
    })),
  };

  return (
    <main className={ui.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader />

      <div className={ui.shell}>
        {/* Hero */}
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <Link className={styles.newPill} href="/muse">
              <span>New</span> Meta&apos;s Muse Gadgets SDK →
            </Link>
            <h1>Give your AI agent a body.</h1>
            <p className={styles.lede}>
              Hackshop helps you build a small gadget for your AI agent. Describe
              it, get the right board and parts, and start a build with the steps
              and a brief your coding agent can follow. It starts with Meta&apos;s
              Muse: {esp32.length} ESP32 boards and any Raspberry Pi.
            </p>
            <div className={ui.actions}>
              <a className={ui.btnPrimary} href="#start">
                Start a build
              </a>
              <Link className={ui.btnSecondary} href="/muse">
                Browse the boards
              </Link>
            </div>
            <p className={styles.trust}>
              Free and open source · No account needed to start · Never buys anything without your OK
            </p>
          </div>
          <TellMyAgent variant="hero" prompt={GENERAL_AGENT_PROMPT} surface="home_hero" />
        </section>

        {/* Product strip */}
        <section className={styles.strip} aria-label="Example gadgets">
          {heroRows.map(({ id, caption, row }, index) => (
            <Link
              key={id}
              href={boardPath(id) ?? `/build/${id}`}
              className={`${styles.stripItem} ${index === 1 ? styles.stripOffset : ""}`}
            >
              <ProductTile deviceId={id} name={row.device.name} priority />
              <span className={styles.stripCaption}>
                <strong>{caption}</strong>
                <span>
                  {row.device.name} · {row.priceLabel}
                </span>
              </span>
            </Link>
          ))}
        </section>

        {/* How it works */}
        <section className={ui.section} aria-labelledby="how">
          <div className={ui.sectionHead}>
            <p className={ui.eyebrow}>How it works</p>
            <h2 id="how">Two ways to build it</h2>
            <p>Let your agent drive, or do it yourself here. Both end with a saved build.</p>
          </div>
          <div className={ui.grid2}>
            <article className={styles.path}>
              <span className={styles.pathBadge}>With your agent</span>
              <h3>Point your agent at hackshop.dev</h3>
              <ol>
                <li>Paste the prompt into Claude, ChatGPT or your coding agent.</li>
                <li>It asks you a few questions: size, features, budget.</li>
                <li>It finds the build and makes the shopping list for you to approve.</li>
                <li>It walks you through assembly, flashing and pairing.</li>
              </ol>
            </article>
            <article className={styles.path}>
              <span className={styles.pathBadgeAlt}>On your own</span>
              <h3>
                <a className={styles.pathLink} href="#start">
                  Use the planner on this page
                </a>
              </h3>
              <ol>
                <li>Answer a few quick questions, or describe the gadget.</li>
                <li>Compare the boards that can do it, with prices.</li>
                <li>Press Start this build: parts, steps and a checklist save to My builds.</li>
                <li>Hand any step to your agent with one click.</li>
              </ol>
              <a className={ui.linkArrow} href="#start">
                Find your board →
              </a>
            </article>
          </div>
          <Flow />
          <p className={styles.next}>
            Next: the assembly steps are machine-readable, so a robot can follow them too.
          </p>
        </section>

        {/* Planner */}
        <section className={`${ui.section} ${styles.plannerSection}`} id="start" aria-label="Find your board">
          <div className={ui.panel}>
            <GadgetPlanner source="home" readQuery difficulties={difficultyMap()} />
          </div>
        </section>

        {/* Templates */}
        <section className={ui.section} aria-labelledby="gadgets">
          <div className={ui.sectionHead}>
            <p className={ui.eyebrow}>Ideas</p>
            <h2 id="gadgets">Gadgets you can build this weekend</h2>
            <p>Each one starts from an officially supported board. Press Start this build to save it.</p>
          </div>
          <div className={ui.grid3}>
            {museTemplates.map((template) => {
              const row = template.device_id ? rowsById.get(template.device_id) : undefined;
              const recipe = embodimentRecipe(template.slug);
              return (
                <article className={styles.ideaCard} key={template.slug}>
                  {template.device_id ? (
                    <ProductTile deviceId={template.device_id} name={row?.device.name ?? template.title} hasPhoto={hasImage(template.device_id)} />
                  ) : null}
                  <h3>{template.title}</h3>
                  <p className={ui.muted}>{template.blurb}</p>
                  <p className={styles.ideaMeta}>
                    {row?.device.name ?? "Linux mini PC"} · ~${template.est_cost_usd.min}
                    {template.est_cost_usd.max !== template.est_cost_usd.min
                      ? `-${template.est_cost_usd.max}`
                      : ""}
                  </p>
                  {template.device_id ? (
                    <div className={ui.actions}>
                      <StartBuildButton
                        className={`${ui.btnPrimary} ${ui.btnSmall}`}
                        deviceId={template.device_id}
                        idea={template.prompt}
                        source="home_template"
                        label="Start this build"
                      />
                      <Link className={ui.linkArrow} href={recipe ? `/builds/${recipe.slug}` : `/build/${template.device_id}`}>
                        {recipe ? "See full recipe" : "See the steps"}
                      </Link>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>

        {/* Boards */}
        <section className={ui.section} aria-labelledby="boards">
          <div className={ui.sectionHead}>
            <p className={ui.eyebrow}>Supported boards</p>
            <h2 id="boards">Pick a board</h2>
            <p>Every board Meta&apos;s Muse SDK supports today, plus the Raspberry Pi.</p>
          </div>
          <div className={ui.grid4}>
            {boardGrid.map((row) => (
              <BoardCard row={row} key={row.device.id} />
            ))}
          </div>
          <p className={ui.actions} style={{ marginTop: 20, gap: "10px 24px" }}>
            <Link className={ui.linkArrow} href="/store">
              Shop every board and part →
            </Link>
            <Link className={ui.linkArrow} href="/muse#compare">
              Compare every board →
            </Link>
          </p>
        </section>

        {/* Agents */}
        <section className={ui.section} id="use-with-your-agent" aria-labelledby="agents">
          <div className={styles.agentGrid}>
            <div>
              <p className={ui.eyebrow}>For agents</p>
              <h2 id="agents" className={styles.h2}>
                Use it from your agent
              </h2>
              <p className={ui.muted}>
                Hackshop is also an MCP server. Add it to Claude, ChatGPT, Claude
                Code, Codex or Cursor and ask it to plan a gadget. Your agent gets
                the same planner, build steps, shopping lists and assembly
                instructions you see here.
              </p>
              <p className={ui.muted}>
                No MCP? Agents can read <a href="/agents.md">/agents.md</a> and
                call the plain JSON endpoints listed there.
              </p>
            </div>
            <AgentConnect />
          </div>
        </section>

        {/* Repurpose */}
        <section className={ui.section} id="scout" aria-labelledby="repurpose">
          <div className={ui.sectionHead}>
            <p className={ui.eyebrow}>Hardware scout</p>
            <h2 id="repurpose">Repurpose hardware you already have</h2>
            <p>
              Old Kindle, spare phone, a Roomba in the closet? Ask the hardware
              scout which ones are hackable and what they could become.{" "}
              <Link className={ui.linkArrow} href="/templates">
                Browse templates →
              </Link>
            </p>
          </div>
          <div className={styles.scout}>
            <DemoForm />
          </div>
        </section>

        {/* FAQ */}
        <section className={ui.section} aria-label="Top ideas">
          <TopIdeas />
        </section>

        <section className={ui.section} aria-labelledby="faq">
          <div className={ui.sectionHead}>
            <p className={ui.eyebrow}>Questions</p>
            <h2 id="faq">FAQ</h2>
          </div>
          <div className={styles.faq}>
            {faq.map((entry) => (
              <details key={entry.question}>
                <summary>{entry.question}</summary>
                <p>{entry.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </div>

      <SiteFooter />
    </main>
  );
}

function BoardCard({ row }: { row: MuseBoardRow }) {
  const href = boardPath(row.device.id) ?? `/build/${row.device.id}`;
  return (
    <article className={styles.boardCard}>
      <Link href={href} className={styles.boardLink}>
        <ProductTile deviceId={row.device.id} name={row.device.name} hasPhoto={hasImage(row.device.id)} />
        <span className={styles.boardName}>{row.device.name}</span>
      </Link>
      <div className={ui.pillRow}>
        <span className={row.tier === "full-ui" ? ui.pillAccent : ui.pill}>{plainTierLabel(row.tier) ?? row.tierLabel}</span>
        <span className={ui.pill}>{row.priceLabel}</span>
      </div>
      <p className={styles.boardFeatures}>{featureChips(row).join(" · ") || "Status light and button"}</p>
      <StartBuildButton
        className={`${ui.btnSecondary} ${ui.btnSmall}`}
        deviceId={row.device.id}
        source="home_board"
      />
    </article>
  );
}

function featureChips(row: MuseBoardRow): string[] {
  const f = row.board.features;
  const chips: string[] = [];
  if (row.voiceLabel === "Voice in, text replies") chips.push("Voice in");
  else if (row.voiceLabel) chips.push(row.voiceLabel === "Text replies" ? "Text replies" : "Voice in, no speaker");
  if (f.touch === true) chips.push("Touch");
  if (f.camera === true) chips.push("Camera");
  if (f.air_sensors === true) chips.push("Air sensors");
  if (f.round_display === true) chips.push("Round");
  if (f.battery === "yes") chips.push("Battery");
  if (row.imageLabel === "B&W") chips.push("E-paper");
  if (f.compute !== undefined) {
    return ["Shell and files", f.compute === "light" ? "Light tasks" : "Server-ready"];
  }
  return chips.slice(0, 3);
}

function Flow() {
  const nodes: Array<{ label: string; sub: string; accent?: boolean }> = [
    { label: "You", sub: "what it should do" },
    { label: "Your agent", sub: "asks a few questions" },
    { label: "hackshop", sub: "boards, parts, steps", accent: true },
    { label: "Shopping list", sub: "you approve" },
    { label: "Assemble + flash", sub: "step by step" },
    { label: "Muse app", sub: "pair and say hi" },
  ];
  return (
    <ol className={styles.flow} aria-label="How a build flows">
      {nodes.map((node, index) => (
        <li key={node.label} className={styles.flowItem}>
          <span className={node.accent ? styles.flowNodeAccent : styles.flowNode}>
            <strong>{node.label}</strong>
            <span>{node.sub}</span>
          </span>
          {index < nodes.length - 1 ? (
            <svg className={styles.flowArrow} viewBox="0 0 40 16" aria-hidden="true">
              {index < 2 ? (
                <path d="M4 5h30m-5-4 5 4-5 4M36 11H6m5-4-5 4 5 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              ) : (
                <path d="M4 8h30m-6-5 6 5-6 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              )}
            </svg>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function homeFaq(cheapest: number, boardCount: number) {
  return [
    {
      question: "What is hackshop?",
      answer:
        "A free, open-source helper for building physical gadgets for AI agents. It picks a board that can do what you want, lists the parts with store links, and gives you build and assembly steps plus a brief your coding agent can follow. It also scouts old hardware you could repurpose.",
    },
    {
      question: "What is Muse?",
      answer: `Muse is Meta's personal AI agent. Its open-source Gadgets SDK turns small off-the-shelf boards into devices Muse can talk through, show things on and control. Hackshop tracks all ${boardCount} supported ESP32 boards and the Raspberry Pi.`,
    },
    {
      question: "Do I need to know how to code?",
      answer:
        "No. Your coding agent (Claude Code, Codex, Cursor or Muse Code) does the typing. You plug in a USB cable, press a button when asked, and pair it in the Muse app.",
    },
    {
      question: "What does it cost?",
      answer: `Boards start at about $${cheapest}. Hackshop itself is free.`,
    },
    {
      question: "Does hackshop buy anything for me?",
      answer:
        "No. Store links open the store. If your agent helps you buy the parts, it shows you the exact items and total and waits for a clear yes before it checks out. Amazon and eBay checkout is always yours.",
    },
    {
      question: "Can I use it without Muse?",
      answer:
        "Yes. The hardware scout, the templates and the MCP tools work for any hardware project.",
    },
    {
      question: "Where are my builds saved?",
      answer: "In your browser. Sign in to keep them on all your devices.",
    },
  ];
}
