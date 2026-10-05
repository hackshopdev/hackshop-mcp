import Link from "next/link";
import { pageMetadata } from "@/lib/page-metadata";
import { TOOLS } from "@/lib/tools/catalog";
import { ToolPage, type FaqItem } from "./_components/ToolPage";
import styles from "./tools.module.css";

export const dynamic = "force-static";

const TITLE = "Free tools for building AI agent gadgets";
const DESCRIPTION =
  "Free tools for building a gadget for your AI agent: pick a Muse board, check if your board runs Muse, find your ESP32's serial port, and see if a 3D printer is worth it.";

export const metadata = pageMetadata(`${TITLE} · Hackshop`, DESCRIPTION, "/tools");

const FAQ: FaqItem[] = [
  {
    question: "Are these tools free?",
    answer:
      "Yes. They run in your browser, need no account, and don't send what you type anywhere. The board picker asks hackshop's planner for picks; it only sends your four answers.",
  },
  {
    question: "What is a Muse gadget?",
    answer:
      "Muse is Meta's personal AI agent. Muse Gadgets are open source devices you build yourself: you program an off-the-shelf ESP32 board or set up a Raspberry Pi with Meta's SDKs, then pair it with the Muse app.",
  },
  {
    question: "Where do the prices come from?",
    answer:
      "Mostly from each seller's own US store page, checked on October 5, 2026. Every page that shows a price links its sources. Prices change often, so check the seller before you buy.",
  },
  {
    question: "I'm new to this. Where should I start?",
    answer:
      "Start with the board picker. It asks where the gadget will live, how you'll use it, whether it should sense the room and your budget, then suggests three boards with the steps to build one.",
  },
];

export default function ToolsIndexPage() {
  return (
    <ToolPage
      path="/tools"
      crumb="Tools"
      eyebrow="Free tools"
      title={TITLE}
      intro={
        <p>
          Four small tools that answer the questions people ask before they build a gadget for an AI
          agent: which board to buy, whether a board they own runs Meta&apos;s Muse, why their ESP32
          isn&apos;t showing up, and whether a 3D printer pays for itself. Each one gives an answer in
          seconds and explains how it got there.
        </p>
      }
      toolLabel="The tools"
      howItWorks={
        <>
          <p>
            The board checker, port finder and cost calculator work entirely in your browser from data
            on this page. The board data comes from Meta&apos;s open source Muse Gadgets SDK, and the
            prices come from seller pages checked on October 5, 2026.
          </p>
          <p>
            The board picker sends your four answers to the same planner that runs the{" "}
            <Link href="/#start">Start a build</Link> box, and shows its top three picks.
          </p>
        </>
      }
      faq={FAQ}
      related={[
        { href: "/muse", label: "Muse gadgets", blurb: "Every supported board compared, with build steps." },
        { href: "/store", label: "Store", blurb: "Seller links for every board and the parts each build needs." },
        { href: "/resources", label: "Field guides", blurb: "Plain guides to flashing, pairing and building." },
      ]}
      cta={{
        title: "Ready to build one?",
        body: "Describe the gadget and the planner picks boards, lists the parts and saves the steps to My builds.",
        primary: { href: "/#start", label: "Start a build" },
        secondary: { href: "/tools/muse-board-picker", label: "Take the board quiz" },
      }}
    >
      <div className={styles.toolCards}>
        {TOOLS.map((tool) => (
          <Link className={styles.toolCard} href={tool.path} key={tool.slug}>
            <h2>{tool.name}</h2>
            <p>{tool.blurb}</p>
            <span aria-hidden="true">Open the tool →</span>
          </Link>
        ))}
      </div>
    </ToolPage>
  );
}
