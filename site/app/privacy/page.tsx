import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/LegalPage";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata(
  "Privacy | Hackshop",
  "What hackshop.dev collects and why: metadata-only analytics, optional sign-in, saved builds, public ideas, email, and the services that process it.",
  "/privacy",
);

export const dynamic = "force-static";

const sections: LegalSection[] = [
  {
    id: "summary",
    title: "The short version",
    body: (
      <ul>
        <li>You can use hackshop without an account.</li>
        <li>Analytics count visits and clicks. They never include the text of your idea.</li>
        <li>Signed out, your saved builds stay in your browser.</li>
        <li>Signed in, your builds are stored with your account and only you can see them.</li>
        <li>Ideas you post on the Ideas page are public.</li>
        <li>We don&apos;t sell your data and we don&apos;t run ads.</li>
      </ul>
    ),
  },
  {
    id: "what-we-collect",
    title: "What we collect and why",
    body: (
      <>
        <h3>Analytics</h3>
        <p>
          We use Google Analytics and PostHog to count visits and product actions, such as
          running the planner, starting a build or copying an agent prompt. These events carry
          metadata like counts, timings, which button was used and which page you were on.
          They never include the text of your idea, your constraints or your inventory.
          PostHog also records page views and basic error reports so we can fix bugs.
        </p>
        <p>
          Google Analytics runs with IP anonymization and with ad personalization and Google
          signals turned off. It is skipped entirely when your browser sends Do Not Track.
        </p>
        <h3>Agent and API traffic</h3>
        <p>
          Fetches of agent files such as /llms.txt, /agents.md and /.well-known/ files, and
          calls to the API and the MCP endpoint, are counted with a one-day anonymous id and
          a coarse client type (for example &quot;browser&quot; or &quot;script&quot;). The id
          is a hash that changes every day. The raw IP address is not stored in analytics.
        </p>
        <h3>Your account (optional)</h3>
        <p>
          Sign-in is optional and handled by Clerk. If you sign in, Clerk holds your email
          address and sign-in details. We use your account to sync saved builds, send a
          shopping list you ask for, and link the ideas and votes you post.
        </p>
        <h3>Saved builds</h3>
        <p>
          When you&apos;re signed out, saved builds live only in your browser&apos;s local
          storage. We don&apos;t receive them. When you&apos;re signed in, they are stored in
          Supabase, linked to your account: the title, your idea, the board, status,
          checklist, part statuses and notes. Only you can see them.
        </p>
        <h3>Ideas and votes</h3>
        <p>
          On the <Link href="/ideas">Ideas</Link> page, signed-in people can post ideas and
          upvote them, one vote per person per idea. We store the idea, the display name you
          choose (if any), your account id and your votes. Ideas and display names are public
          and anyone can see them. Your account id and email are not shown.
        </p>
        <h3>Email</h3>
        <p>
          If you use the <Link href="/contact">contact form</Link>, your message and the name
          and email you choose to add are sent by email through Resend to our inbox. They are
          kept only in that inbox. If you ask us to email you a shopping list, we send it
          through Resend to the verified email on your account, and only that address.
        </p>
        <h3>Hardware scout</h3>
        <p>
          The hardware scout on the home page sends what you type to Anthropic&apos;s Claude
          API to write its suggestions. If you ask for a diagram, the request goes to
          OpenAI&apos;s image API. We don&apos;t store what you type there. The Muse planner
          works on our own server and doesn&apos;t send your idea to an AI service.
        </p>
        <h3>The npm package</h3>
        <p>
          The open-source hackshop-mcp server that runs on your computer sends anonymous
          usage pings: the tool name, timing, success, version, MCP client name, operating
          system, Node version and a random install id. It never sends tool inputs, ideas,
          results or keys. Set <code>HACKSHOP_TELEMETRY=0</code> (or{" "}
          <code>DO_NOT_TRACK=1</code>) to turn this off.
        </p>
        <h3>Server logs</h3>
        <p>
          Our host keeps standard request logs (such as IP address, page and time) for a short
          period for security and debugging.
        </p>
      </>
    ),
  },
  {
    id: "processors",
    title: "Services that process data for us",
    body: (
      <ul>
        <li>
          <strong>Vercel</strong>: hosts the site, the API and the MCP endpoint.
        </li>
        <li>
          <strong>Clerk</strong>: sign-in and accounts.
        </li>
        <li>
          <strong>Supabase</strong>: saved builds for signed-in people, and ideas and votes.
        </li>
        <li>
          <strong>Resend</strong>: contact form messages and shopping-list emails.
        </li>
        <li>
          <strong>Google Analytics</strong> and <strong>PostHog</strong>: analytics.
        </li>
        <li>
          <strong>Anthropic</strong> and <strong>OpenAI</strong>: only for the hardware
          scout&apos;s suggestions and diagrams.
        </li>
      </ul>
    ),
  },
  {
    id: "cookies",
    title: "Cookies and local storage",
    body: (
      <>
        <ul>
          <li>
            <strong>Local storage</strong> keeps your saved builds and your hardware inventory
            in this browser.
          </li>
          <li>
            <strong>Analytics cookies and storage</strong> from Google Analytics and PostHog
            tell repeat visits apart.
          </li>
          <li>
            <strong>Sign-in cookies</strong> from Clerk keep you signed in.
          </li>
        </ul>
        <p>We don&apos;t use advertising cookies.</p>
      </>
    ),
  },
  {
    id: "retention",
    title: "How long we keep it",
    body: (
      <ul>
        <li>Saved builds stay until you delete them or ask us to delete your account.</li>
        <li>Ideas and votes stay until you ask us to remove them or we remove them.</li>
        <li>Contact messages stay in our inbox only as long as we need them.</li>
        <li>Analytics data is kept under each analytics provider&apos;s retention settings.</li>
        <li>Data in your browser stays until you delete it or clear your browser storage.</li>
      </ul>
    ),
  },
  {
    id: "choices",
    title: "Your choices",
    body: (
      <ul>
        <li>
          Delete any saved build in <Link href="/projects">My builds</Link>.
        </li>
        <li>Clear your browser&apos;s site data to remove builds saved only in this browser.</li>
        <li>Turn on Do Not Track or use a blocker to skip analytics.</li>
        <li>
          Ask us to delete your account, your saved builds or your ideas, or to send you a
          copy of your data, through the <Link href="/contact">contact page</Link>.
        </li>
        <li>
          Turn off the npm package&apos;s pings with <code>HACKSHOP_TELEMETRY=0</code>.
        </li>
      </ul>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: (
      <p>
        hackshop is not meant for children under 13, and we don&apos;t knowingly collect
        their information. If you think a child has given us personal information, contact
        us and we will delete it.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: (
      <p>
        We may update this policy. When we do, we change the date at the top of this page.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p>
        Questions or requests about your data? Use the <Link href="/contact">contact page</Link>.
      </p>
    ),
  },
];

export default function Page() {
  return (
    <LegalPage
      eyebrow="Trust and transparency"
      title="Privacy"
      updated="October 5, 2026"
      intro={
        <p>
          This page explains what hackshop.dev collects, why, and who processes it. hackshop
          is the operator of this site. See also the <Link href="/terms">Terms</Link>.
        </p>
      }
      sections={sections}
    />
  );
}
