import Link from "next/link";
import { ProductTile } from "@/components/ProductTile";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { StartBuildButton } from "@/components/StartBuildButton";
import { StoreLinkOut } from "@/components/StoreLinkOut";
import { TellMyAgent } from "@/components/TellMyAgent";
import ui from "@/components/ui.module.css";
import { buyEverythingPrompt, SITE_URL, STORE_AGENT_PROMPT } from "@/lib/agent-prompts";
import { fetchEbayListingsMany, isEbayConfigured, type EbayListing } from "@/lib/ebay";
import { pageMetadata } from "@/lib/page-metadata";
import { commonParts, storeBoards, storeBoardsByGroup, type StoreBoard } from "@/lib/store";
import styles from "./store.module.css";

export const revalidate = 3600;

export const metadata = pageMetadata(
  "Store: every board and part for a Muse gadget · Hackshop",
  "Buy the boards and parts for a Muse gadget: seller and Amazon links for every Muse-supported board, the newest used listings on eBay, and the full parts list for each build.",
  "/store",
);

const FAQ = [
  {
    question: "Does hackshop sell these?",
    answer:
      "No. Hackshop doesn't stock or ship hardware. Every link goes to the seller, Amazon or eBay, and you check out there.",
  },
  {
    question: "Can my agent buy everything for me?",
    answer:
      "With your OK. Use \"Tell my agent to buy everything\": your agent finds the best current price for each part and shows you one list with the total. After you approve, it can order from seller stores like Waveshare or M5Stack. Amazon and eBay don't allow automated checkout, so it hands you those links to buy yourself.",
  },
  {
    question: "New or used?",
    answer:
      "Small ESP32 boards are cheap new, so buy those from the seller. Raspberry Pis and mini PCs are often half price used on eBay. Check the listing says it powers on and ships with the board, not just a case.",
  },
  {
    question: "Why do the ESP32 builds need a USB-C data cable?",
    answer:
      "Flashing needs a cable that carries data. Many cables in drawers only charge, and that's the most common reason a board won't show up when you flash it.",
  },
];

export default async function StorePage() {
  const groups = storeBoardsByGroup();
  const boards = storeBoards();
  const parts = commonParts();
  const ebayLive = isEbayConfigured();
  const showAffiliateDisclosure = Boolean(process.env.AMAZON_ASSOCIATE_TAG || process.env.EBAY_CAMPAIGN_ID);
  const listings = ebayLive
    ? await fetchEbayListingsMany(
        Object.fromEntries(boards.map((board) => [board.device_id, board.ebay.query])),
        3,
      )
    : {};

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Boards that run Muse",
      itemListElement: boards.map((board, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: board.name,
        url: board.board_page ?? board.build_page,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    },
  ];

  return (
    <main className={ui.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader />
      <div className={ui.shell}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={ui.eyebrow}>Store</p>
            <h1>Everything you need to build a Muse gadget</h1>
            <p className={styles.lede}>
              Every board Muse supports, with a link to buy it new, links to the newest used
              listings on eBay, and the parts each build needs. Pick a board, get
              the parts, then follow the build.
            </p>
            <div className={ui.actions}>
              <a className={ui.btnPrimary} href="#featured">
                Shop the boards
              </a>
              <Link className={ui.btnSecondary} href="/#start">
                Not sure? Start a build
              </Link>
            </div>
            <ul className={styles.trust}>
              <li>Links go straight to the seller, Amazon or eBay</li>
              <li>Hackshop doesn&apos;t sell hardware</li>
              <li>Your agent asks before it buys anything</li>
            </ul>
            {showAffiliateDisclosure ? (
              <p className={styles.affiliateDisclosure}>
                Some links are affiliate links. If you buy, hackshop may earn a small commission at no cost to you.
              </p>
            ) : null}
          </div>
          <TellMyAgent
            variant="hero"
            prompt={STORE_AGENT_PROMPT}
            surface="store_hero"
            title="Tell my agent to buy everything"
            blurb="Paste this into Claude, ChatGPT or your agent. It asks what you're building, finds the best price for each part (new or used), and shows you one list with the total before it buys anything."
          />
        </section>

        <nav className={styles.jump} aria-label="Store sections">
          <a href="#from-meta">From Meta</a>
          {groups.map((group) => (
            <a key={group.id} href={`#${group.id}`}>
              {group.title} <span>{group.boards.length}</span>
            </a>
          ))}
          <a href="#parts">Parts</a>
        </nav>

        <section className={styles.group} id="from-meta" aria-labelledby="from-meta-h">
          <div className={ui.sectionHead}>
            <h2 id="from-meta-h">From Meta</h2>
            <p>Meta&apos;s own Muse hardware, for homes that already have devices to reach.</p>
          </div>
          <div className={styles.metaCards}>
            <article className={styles.metaCard}>
              <span className={styles.metaMark} aria-hidden="true" />
              <div className={styles.metaHead}>
                <h3>Muse Home Link</h3>
                <span className={ui.pillAccent}>Free with Muse</span>
              </div>
              <p>
                Connects Muse to your home Wi-Fi so it can reach compatible devices you already own, or anything you
                build with a local HTTP API.
              </p>
              <p className={styles.finePrint}>
                Free with an active Muse subscription, US only, one per subscriber. Ships in October.
              </p>
              <StoreLinkOut
                href="https://gadgets.muse.ai/home-link"
                className={styles.chipLink}
                event={{ kind: "meta_device", seller: "Meta" }}
              >
                Claim it on gadgets.muse.ai
              </StoreLinkOut>
            </article>
            <article className={styles.metaCard}>
              <span className={styles.metaMark} aria-hidden="true" />
              <div className={styles.metaHead}>
                <h3>Muse on your TV</h3>
                <span className={ui.pill}>Coming soon</span>
              </div>
              <p>An HDMI stick so Muse can put things on the TV.</p>
              <StoreLinkOut
                href="https://gadgets.muse.ai/"
                className={styles.textLink}
                event={{ kind: "meta_device", seller: "Meta" }}
              >
                See gadgets.muse.ai
              </StoreLinkOut>
            </article>
          </div>
        </section>

        {groups.map((group) => (
          <section className={styles.group} id={group.id} key={group.id} aria-labelledby={`${group.id}-h`}>
            <div className={ui.sectionHead}>
              <h2 id={`${group.id}-h`}>{group.title}</h2>
              <p>{group.blurb}</p>
            </div>
            <div className={styles.cards}>
              {group.boards.map((board) => (
                <StoreCard
                  key={board.device_id}
                  board={board}
                  listings={listings[board.device_id] ?? null}
                  ebayLive={ebayLive}
                />
              ))}
            </div>
          </section>
        ))}

        <section className={styles.group} id="parts" aria-labelledby="parts-h">
          <div className={ui.sectionHead}>
            <h2 id="parts-h">Parts most builds need</h2>
            <p>Cables, power and storage. Any decent brand works; these are the specs that matter.</p>
          </div>
          <div className={styles.partsTable} role="table" aria-label="Common parts">
            {parts.map((part) => (
              <div className={styles.partRow} role="row" key={part.name}>
                <div role="cell">
                  <strong>{part.name}</strong>
                  <span className={ui.muted}>
                    Used by {part.used_by.length} board{part.used_by.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div role="cell" className={styles.partPrice}>
                  {part.est_price_usd !== null ? `~$${part.est_price_usd}` : ""}
                </div>
                <div role="cell" className={styles.partLinks}>
                  {part.links.map((link) => (
                    <StoreLinkOut
                      key={link.url}
                      href={link.url}
                      className={styles.chipLink}
                      event={{ kind: "part", seller: link.label }}
                    >
                      {link.label}
                    </StoreLinkOut>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.group} aria-labelledby="faq-h">
          <div className={ui.sectionHead}>
            <h2 id="faq-h">Questions</h2>
          </div>
          <div className={styles.faq}>
            {FAQ.map((item) => (
              <details key={item.question}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
          <p className={styles.agentNote}>
            Agents: the same data is at{" "}
            <a href={`${SITE_URL}/store.json`}>{SITE_URL}/store.json</a>.
          </p>
        </section>
      </div>
      <SiteFooter />
    </main>
  );
}

function StoreCard({
  board,
  listings,
  ebayLive,
}: {
  board: StoreBoard;
  listings: EbayListing[] | null;
  ebayLive: boolean;
}) {
  // Used mini PCs aren't sold new anymore, so lead with eBay for them.
  const usedFirst = board.group === "linux-community" && board.buy[0]?.kind === "search";
  const [primary, ...others] = usedFirst
    ? [{ label: "eBay", url: board.ebay.newest_url, kind: "search" as const }, ...board.buy]
    : board.buy;
  const requiredParts = board.parts.filter((part) => part.required && part.qty > 0);
  const optionalParts = board.parts.filter((part) => !part.required && part.qty > 0);
  const anchor = board.slug ?? board.device_id;

  return (
    <article className={styles.card} id={anchor}>
      <div className={styles.cardTop}>
        <ProductTile
          deviceId={board.device_id}
          name={board.name}
          hasPhoto={board.has_photo}
          className={styles.cardTile}
        />
        <div className={styles.cardHead}>
          <div className={ui.pillRow}>
            {board.muse_featured ? <span className={ui.pillAccent}>On gadgets.muse.ai</span> : null}
            <span className={ui.pill}>{board.tier_label}</span>
            {board.support === "possible" ? <span className={ui.pillWarn}>Community path</span> : null}
          </div>
          <h3>{board.name}</h3>
          <p className={styles.price}>
            {board.price_label}
            {board.est_total_usd !== null ? (
              <span> · about ${Math.round(board.est_total_usd)} with parts</span>
            ) : null}
          </p>
          <p className={styles.desc}>{board.description}</p>
          {board.capabilities.length > 0 ? (
            <p className={styles.caps}>{board.capabilities.join(" · ")}</p>
          ) : null}
        </div>
      </div>

      <div className={styles.buyRow}>
        {primary ? (
          <StoreLinkOut
            href={primary.url}
            className={ui.btnPrimary}
            event={{ kind: "board", seller: primary.label, device_id: board.device_id }}
          >
            {usedFirst
              ? "Shop used on eBay"
              : primary.kind === "search"
                ? `Find on ${primary.label}`
                : `Buy new · ${primary.label}`}
          </StoreLinkOut>
        ) : null}
        {others.map((link) => (
          <StoreLinkOut
            key={link.url}
            href={link.url}
            className={styles.chipLink}
            title={link.note}
            event={{ kind: "board", seller: link.label, device_id: board.device_id }}
          >
            {link.label}
          </StoreLinkOut>
        ))}
      </div>

      <div className={styles.ebay}>
        <div className={styles.ebayHead}>
          <strong>Newest on eBay</strong>
          {listings && listings.length > 0 ? (
            <StoreLinkOut
              href={board.ebay.newest_url}
              className={styles.textLink}
              event={{ kind: "ebay_search", seller: "eBay", device_id: board.device_id }}
            >
              See all
            </StoreLinkOut>
          ) : null}
        </div>
        {listings && listings.length > 0 ? (
          <ul className={styles.listings}>
            {listings.map((listing) => (
              <li key={listing.url}>
                <StoreLinkOut
                  href={listing.url}
                  className={styles.listing}
                  event={{ kind: "ebay_listing", seller: "eBay", device_id: board.device_id }}
                >
                  {listing.image_url ? (
                    <img src={listing.image_url} alt="" width={56} height={56} loading="lazy" />
                  ) : (
                    <span className={styles.listingNoImg} aria-hidden="true" />
                  )}
                  <span className={styles.listingText}>
                    <span className={styles.listingTitle}>{listing.title}</span>
                    <span className={ui.muted}>
                      {[listing.condition, listedAgo(listing.listed_at)].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className={styles.listingPrice}>
                    {listing.price_usd !== null ? `$${listing.price_usd.toFixed(0)}` : ""}
                  </span>
                </StoreLinkOut>
              </li>
            ))}
          </ul>
        ) : (
          <p className={ui.muted}>
            {ebayLive && listings
              ? "No Buy It Now listings right now. "
              : board.group === "featured" || board.group === "esp32"
                ? "Sometimes cheaper used or open-box. "
                : "Often half the price used. "}
            <StoreLinkOut
              href={board.ebay.newest_url}
              className={styles.textLink}
              event={{ kind: "ebay_search", seller: "eBay", device_id: board.device_id }}
            >
              See the newest listings
            </StoreLinkOut>
          </p>
        )}
      </div>

      {requiredParts.length + optionalParts.length > 0 ? (
        <div className={styles.needs}>
          <strong>You&apos;ll also need</strong>
          <ul>
            {[...requiredParts, ...optionalParts].map((part) => (
              <li key={part.name}>
                <span>
                  {part.qty} × {part.name}
                  {part.required ? "" : <em> (optional)</em>}
                  {part.est_price_usd !== null ? <span className={ui.muted}> · ~${part.est_price_usd}</span> : null}
                </span>
                <span className={styles.partLinks}>
                  {part.url ? (
                    <StoreLinkOut
                      href={part.url}
                      className={styles.textLink}
                      event={{ kind: "part", seller: part.seller ?? "seller", device_id: board.device_id }}
                    >
                      {part.url_kind === "buy" ? part.seller ?? "Buy" : "Amazon"}
                    </StoreLinkOut>
                  ) : null}
                  {part.ebay_url ? (
                    <StoreLinkOut
                      href={part.ebay_url}
                      className={styles.textLink}
                      event={{ kind: "part", seller: "eBay", device_id: board.device_id }}
                    >
                      eBay
                    </StoreLinkOut>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className={styles.cardActions}>
        <StartBuildButton className={`${ui.btnSecondary} ${ui.btnSmall}`} deviceId={board.device_id} source="store" />
        <TellMyAgent
          prompt={buyEverythingPrompt({ name: board.name, deviceId: board.device_id })}
          surface="store_card"
          label="Tell my agent to buy it all"
        />
        {board.board_page ? (
          <Link className={styles.innerLink} href={`/muse/${board.slug}`}>
            Board details
          </Link>
        ) : (
          <Link className={styles.innerLink} href={`/build/${board.device_id}`}>
            Build steps
          </Link>
        )}
      </div>
    </article>
  );
}

function listedAgo(iso: string | null): string | null {
  if (!iso) return null;
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return null;
  const hours = Math.max(0, (Date.now() - then) / 3_600_000);
  if (hours < 1) return "listed just now";
  if (hours < 24) return `listed ${Math.round(hours)}h ago`;
  const days = Math.round(hours / 24);
  return `listed ${days}d ago`;
}
