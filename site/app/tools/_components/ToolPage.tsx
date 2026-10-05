import Link from "next/link";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import ui from "@/components/ui.module.css";
import { PRICES_CHECKED_LABEL, type SourceLink } from "@/lib/tools/sources";
import styles from "../tools.module.css";

const SITE_URL = "https://www.hackshop.dev";

export interface FaqItem {
  question: string;
  answer: string;
}

export interface RelatedLink {
  href: string;
  label: string;
  blurb: string;
}

export interface CtaBlock {
  title: string;
  body: string;
  primary: { href: string; label: string };
  secondary?: { href: string; label: string };
}

export function ToolPage({
  path,
  crumb,
  eyebrow,
  title,
  intro,
  children,
  toolLabel,
  howItWorks,
  faq,
  related,
  cta,
  sources,
  showPricesChecked = false,
  app,
}: {
  path: string;
  crumb: string;
  eyebrow: string;
  title: string;
  intro: ReactNode;
  children: ReactNode;
  toolLabel: string;
  howItWorks: ReactNode;
  faq: FaqItem[];
  related: RelatedLink[];
  cta: CtaBlock;
  sources?: SourceLink[];
  showPricesChecked?: boolean;
  /** WebApplication JSON-LD for the tool pages (not the index). */
  app?: { name: string; description: string };
}) {
  const isIndex = path === "/tools";
  const jsonLd: Array<Record<string, unknown>> = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Tools", item: `${SITE_URL}/tools` },
        ...(isIndex ? [] : [{ "@type": "ListItem", position: 3, name: crumb, item: `${SITE_URL}${path}` }]),
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    },
  ];
  if (app) {
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: app.name,
      description: app.description,
      url: `${SITE_URL}${path}`,
      applicationCategory: "UtilitiesApplication",
      operatingSystem: "Any (runs in the browser)",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      publisher: { "@id": `${SITE_URL}/#org` },
    });
  }

  return (
    <main className={ui.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <SiteHeader />
      <div className={ui.shell}>
        <nav className={styles.crumbs} aria-label="Breadcrumb">
          <ol>
            <li>
              <Link href="/">Home</Link>
            </li>
            <li>{isIndex ? <span aria-current="page">Tools</span> : <Link href="/tools">Tools</Link>}</li>
            {isIndex ? null : (
              <li>
                <span aria-current="page">{crumb}</span>
              </li>
            )}
          </ol>
        </nav>

        <div className={styles.hero}>
          <p className={ui.eyebrow}>{eyebrow}</p>
          <h1>{title}</h1>
          <div className={styles.intro}>{intro}</div>
          {showPricesChecked ? (
            <p className={styles.checked}>
              {PRICES_CHECKED_LABEL}. <a href="#sources">Sources</a>
            </p>
          ) : null}
        </div>

        <section className={styles.toolArea} aria-label={toolLabel}>
          {children}
        </section>

        <section className={styles.block} aria-labelledby="how-it-works">
          <h2 id="how-it-works">How this works</h2>
          <div className={styles.prose}>{howItWorks}</div>
        </section>

        <section className={styles.block} aria-labelledby="faq">
          <h2 id="faq">Questions people ask</h2>
          <div className={styles.faq}>
            {faq.map((item) => (
              <article className={styles.faqItem} key={item.question}>
                <h3>{item.question}</h3>
                <p>{item.answer}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.block} aria-labelledby="related">
          <h2 id="related">Related</h2>
          <div className={styles.related}>
            {related.map((link) => (
              <Link className={styles.relatedCard} href={link.href} key={link.href}>
                <strong>{link.label}</strong>
                <span>{link.blurb}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className={styles.cta} aria-labelledby="cta-title">
          <div>
            <h2 id="cta-title">{cta.title}</h2>
            <p>{cta.body}</p>
          </div>
          <div className={ui.actions}>
            <Link className={ui.btnPrimary} href={cta.primary.href}>
              {cta.primary.label}
            </Link>
            {cta.secondary ? (
              <Link className={ui.btnSecondary} href={cta.secondary.href}>
                {cta.secondary.label}
              </Link>
            ) : null}
          </div>
        </section>

        {sources && sources.length > 0 ? (
          <section className={styles.sources} id="sources" aria-labelledby="sources-title">
            <h2 id="sources-title">Sources</h2>
            {showPricesChecked ? <p>{PRICES_CHECKED_LABEL}. Prices are US list prices before tax and change often.</p> : null}
            <ul>
              {sources.map((source) => (
                <li key={`${source.label}-${source.url}`}>
                  <a href={source.url} rel="noopener noreferrer" target="_blank">
                    {source.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
      <SiteFooter />
    </main>
  );
}
