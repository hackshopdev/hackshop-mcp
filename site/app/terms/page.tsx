import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/LegalPage";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata(
  "Terms | Hackshop",
  "The terms for using hackshop.dev, its planner, guides, API and MCP server: no warranty, flashing risk, third-party sellers, your content and acceptable use.",
  "/terms",
);

export const dynamic = "force-static";

const sections: LegalSection[] = [
  {
    id: "what-hackshop-is",
    title: "What hackshop is",
    body: (
      <>
        <p>
          hackshop is a free website and set of tools for building small gadgets for AI
          agents. It includes a planner that picks boards, build guides, field guides, a
          store page that links to sellers, a public API and an MCP server your agent can
          use.
        </p>
        <p>
          The code is open source under the MIT license and lives at{" "}
          <a href="https://github.com/hackshopdev/hackshop-mcp">github.com/hackshopdev/hackshop-mcp</a>.
          The MIT license covers the code. These terms cover your use of hackshop.dev, its
          API and the hosted MCP server.
        </p>
        <p>
          In these terms, &quot;hackshop&quot;, &quot;we&quot; and &quot;us&quot; mean the
          operator of hackshop.dev. &quot;You&quot; means anyone who uses the site, the API
          or the MCP server, including an agent acting for you. By using hackshop you agree
          to these terms. If you don&apos;t agree, please don&apos;t use it.
        </p>
      </>
    ),
  },
  {
    id: "no-warranty",
    title: "No warranty",
    body: (
      <>
        <p>
          hackshop is provided &quot;as is&quot; and &quot;as available&quot;. We work to keep
          the board picks, parts lists and steps accurate, but they can be wrong, out of
          date or incomplete. We don&apos;t promise that a build will work, that a board is
          right for you, or that the site will always be up.
        </p>
        <p>
          The guides are general information. They are not engineering, electrical, safety,
          legal or financial advice. Check the maker&apos;s documentation before you act on
          anything that matters.
        </p>
      </>
    ),
  },
  {
    id: "hardware-risk",
    title: "Hardware and flashing risk",
    body: (
      <>
        <p>Building and flashing hardware has real risks. In particular:</p>
        <ul>
          <li>
            Flashing new firmware can erase a board or leave it unable to start
            (&quot;bricked&quot;). Some boards hold factory data that can&apos;t be
            replaced if it&apos;s lost.
          </li>
          <li>
            Back up first. When a build&apos;s steps tell you to make a backup, do it before
            you flash.
          </li>
          <li>
            Batteries, chargers and power supplies can overheat. Use the parts the maker
            recommends, don&apos;t leave a new build running unattended, and unplug it if it
            gets hot, smells or smokes.
          </li>
          <li>
            Cameras and microphones in your home are a privacy choice. Place them with care
            and tell the people around you.
          </li>
        </ul>
        <p>
          You are responsible for your devices, your power and wiring, and your safety and
          the safety of others.
        </p>
      </>
    ),
  },
  {
    id: "third-parties",
    title: "Third-party products, sellers and services",
    body: (
      <>
        <p>
          The boards and parts on hackshop are made and sold by other companies. Sellers,
          marketplaces such as Amazon and eBay, and Meta&apos;s Muse service and Gadgets SDK
          each have their own terms, warranties and policies. Those govern what you buy and
          how you use their services. For example, Meta&apos;s SDK token terms allow
          personal, non-commercial use only.
        </p>
        <p>
          hackshop isn&apos;t affiliated with those companies unless we say so, and we
          aren&apos;t responsible for their products, sites or support.
        </p>
      </>
    ),
  },
  {
    id: "prices",
    title: "Prices and availability",
    body: (
      <p>
        Prices, stock and shipping shown on hackshop are estimates. They were checked by
        hand at some point and can change at any time. The price the seller shows at
        checkout is the one that counts.
      </p>
    ),
  },
  {
    id: "buying",
    title: "hackshop doesn't sell or buy anything",
    body: (
      <>
        <p>
          hackshop doesn&apos;t sell hardware, take payments or place orders. Store links
          open the seller&apos;s own site, and you check out there.
        </p>
        <p>
          If you use an AI agent with hackshop, the agent works for you, not for hackshop.
          Our prompts and agent files tell agents to show you the exact items, sellers and
          total, ask &quot;Place this order for $&lt;total&gt; at &lt;seller&gt;?&quot; and
          wait for a clear yes before they buy anything, and to give you the links when a
          site doesn&apos;t allow automated checkout (Amazon and eBay don&apos;t). Check what
          your agent does. You are responsible for purchases you or your agent make.
        </p>
      </>
    ),
  },
  {
    id: "your-content",
    title: "Your content",
    body: (
      <>
        <p>
          <strong>Saved builds are private to you.</strong> When you&apos;re signed out they
          stay in your browser. When you&apos;re signed in they are stored with your account,
          and only you can see them.
        </p>
        <p>
          <strong>Ideas you post on the <Link href="/ideas">Ideas</Link> page are
          public.</strong> Anyone can see them, along with the display name you choose, if
          any. You keep ownership of what you post. By posting, you give hackshop a free,
          worldwide, non-exclusive license to show, copy, adapt and share it on hackshop and
          in hackshop&apos;s own channels, for example by turning an idea into a guide or a
          template.
        </p>
        <p>
          Don&apos;t post personal or confidential information, other people&apos;s private
          details, or anything you don&apos;t have the right to share. We may edit or remove
          content that breaks these terms or that we think is harmful.
        </p>
      </>
    ),
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    body: (
      <>
        <p>Please don&apos;t:</p>
        <ul>
          <li>send spam, or post ads or junk ideas;</li>
          <li>scrape the site in a way that slows it down or harms it;</li>
          <li>
            abuse the API or the MCP endpoint, for example by flooding it with requests or
            working around rate limits;
          </li>
          <li>try to break into accounts, systems or data that aren&apos;t yours;</li>
          <li>use hackshop for anything illegal or to harm others.</li>
        </ul>
        <p>
          Rate limits apply to the API, the MCP endpoint and the forms. We may slow down or
          block traffic that overloads the service.
        </p>
      </>
    ),
  },
  {
    id: "accounts",
    title: "Accounts",
    body: (
      <p>
        You don&apos;t need an account to use hackshop. Sign-in is optional and handled by
        Clerk. It lets you keep saved builds on all your devices, email yourself a shopping
        list and post ideas. Keep your sign-in details safe; you are responsible for what
        happens under your account. You can delete builds in{" "}
        <Link href="/projects">My builds</Link>, and ask us to delete your account through
        the <Link href="/contact">contact page</Link>.
      </p>
    ),
  },
  {
    id: "termination",
    title: "Ending access",
    body: (
      <p>
        You can stop using hackshop at any time. We may suspend or end your access, or
        remove your content, if you break these terms or put the service or other people
        at risk. We may also change or stop parts of hackshop.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to these terms",
    body: (
      <p>
        We may update these terms. When we do, we change the date at the top of this page.
        If you keep using hackshop after a change, you accept the new terms.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Limits on our liability",
    body: (
      <>
        <p>
          hackshop is free, so we can&apos;t take on the cost of things going wrong. To the
          fullest extent the law allows:
        </p>
        <ul>
          <li>
            we are not liable for damaged or bricked hardware, lost data, purchases you or
            your agent make, or any indirect or consequential loss;
          </li>
          <li>
            our total liability for any claim about hackshop is limited to US$50.
          </li>
        </ul>
        <p>
          Some places don&apos;t allow these limits, so they may not all apply to you.
          Nothing here limits rights you have under law that can&apos;t be waived.
        </p>
      </>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p>
        Questions about these terms? Use the <Link href="/contact">contact page</Link>.
      </p>
    ),
  },
];

export default function Page() {
  return (
    <LegalPage
      eyebrow="Trust and transparency"
      title="Terms"
      updated="October 5, 2026"
      intro={
        <p>
          The short version: hackshop is free and open source, comes with no warranty, never
          buys anything for you, and flashing hardware is at your own risk. The details are
          below.
        </p>
      }
      sections={sections}
    />
  );
}
