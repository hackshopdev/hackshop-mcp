import Link from "next/link";
import type { ReactNode } from "react";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import styles from "./LegalPage.module.css";

export interface LegalSection {
  id: string;
  title: string;
  body: ReactNode;
}

// Shared layout for Terms, Privacy and About: a short intro, a list of
// sections and readable H2 sections.
export function LegalPage({
  eyebrow,
  title,
  updated,
  intro,
  sections,
}: {
  eyebrow: string;
  title: string;
  updated: string;
  intro: ReactNode;
  sections: LegalSection[];
}) {
  return (
    <main className={styles.page}>
      <SiteHeader />
      <div className={styles.shell}>
        <article className={styles.article}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h1>{title}</h1>
          <p className={styles.updated}>Last updated {updated}</p>
          <div className={styles.intro}>{intro}</div>
          <nav className={styles.toc} aria-label="On this page">
            <p>On this page</p>
            <ol>
              {sections.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`}>{section.title}</a>
                </li>
              ))}
            </ol>
          </nav>
          {sections.map((section) => (
            <section className={styles.section} id={section.id} key={section.id} aria-labelledby={`${section.id}-h`}>
              <h2 id={`${section.id}-h`}>{section.title}</h2>
              {section.body}
            </section>
          ))}
          <p className={styles.contact}>
            Questions? <Link href="/contact">Contact hackshop</Link>.
          </p>
        </article>
      </div>
      <SiteFooter />
    </main>
  );
}
