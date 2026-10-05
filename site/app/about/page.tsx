import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/LegalPage";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata(
  "About | Hackshop",
  "What hackshop is, who it's for, how the guides are made and how to reach us.",
  "/about",
);

export const dynamic = "force-static";

const sections: LegalSection[] = [
  {
    id: "what",
    title: "What hackshop does",
    body: (
      <>
        <p>
          hackshop helps people and their AI agents build small physical gadgets. Tell the
          planner what you want, and it picks a board that can do it, lists the parts with
          store links, and gives you build steps and a brief your coding agent can follow.
          It starts with Meta&apos;s Muse Gadgets SDK.
        </p>
        <p>
          It is free and open source under the MIT license. The code is on{" "}
          <a href="https://github.com/hackshopdev/hackshop-mcp">GitHub</a>.
        </p>
      </>
    ),
  },
  {
    id: "guides",
    title: "How the guides are made",
    body: (
      <p>
        The <Link href="/resources">field guides</Link> and build steps link the sources
        they rely on, label assumptions, and keep limits in view instead of guessing. Board
        facts come from the makers&apos; documentation and the Muse Gadgets SDK. If you spot
        a mistake, please tell us.
      </p>
    ),
  },
  {
    id: "money",
    title: "How hackshop is paid for",
    body: (
      <p>
        hackshop doesn&apos;t sell hardware or place orders. Some store links may be
        affiliate links; when they are, the store page says so. That never changes which
        board the planner picks.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Get in touch",
    body: (
      <p>
        Questions, corrections and ideas are welcome on the{" "}
        <Link href="/contact">contact page</Link>. See also the{" "}
        <Link href="/privacy">Privacy</Link> and <Link href="/terms">Terms</Link> pages.
      </p>
    ),
  },
];

export default function Page() {
  return (
    <LegalPage
      eyebrow="Trust and transparency"
      title="About"
      updated="October 5, 2026"
      intro={<p>hackshop is built and run by the hackshop team.</p>}
      sections={sections}
    />
  );
}
