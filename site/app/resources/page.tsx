import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import type { Metadata } from "next";
import Link from "next/link";
import { editorialPosts } from "@/lib/editorial";
import styles from "./editorial.module.css";

export const metadata: Metadata = {
  title: "Resources | Hackshop",
  description: "Field guides for choosing, evaluating, flashing, recovering, and repurposing hackable hardware.",
  alternates: { canonical: "/resources" },
  openGraph: { title: "Resources | Hackshop", description: "Field guides for choosing, evaluating, flashing, recovering, and repurposing hackable hardware.", url: "/resources", images: ["/opengraph-image"] },
  twitter: { card: "summary_large_image", images: ["/opengraph-image"] },
};

export default function ResourcesPage() {
  return <main className={styles.page}><SiteHeader />
    <div className={styles.shell}>
      
      <header className={styles.hero}><p className={styles.eyebrow}>Practical, source-linked field guides</p><h1>Make the next decision with evidence.</h1><p>Field guides for choosing, evaluating, flashing, recovering, and repurposing hackable hardware. Every guide includes a repeatable workflow, explicit limits, primary sources, internal links, and a real next step.</p></header>
      <Link className={`${styles.card} ${styles.pillar}`} href="/muse" style={{display:"block",marginBottom:18}}><div className={styles.meta}><span className={styles.pill}>New</span><span className={styles.pill}>Muse gadgets</span></div><h2>Give Meta&apos;s Muse a body: every supported board compared</h2><p>Which ESP32 boards and Raspberry Pis work with Meta&apos;s Muse Gadgets SDK, what each one can do, printable stands, and a build you can start or hand to your agent.</p></Link><section className={styles.grid} aria-label="All resources">{editorialPosts.map((post) => <Link className={`${styles.card} ${post.pillar ? styles.pillar : ""}`} href={`/resources/${post.slug}`} key={post.slug}><div className={styles.meta}><span className={styles.pill}>{post.pillar ? "Deep guide" : `${post.readingMinutes} minute guide`}</span>{post.tags.slice(0,2).map((tag)=><span className={styles.pill} key={tag}>{tag}</span>)}</div><h2>{post.title}</h2><p>{post.description}</p></Link>)}</section>
      <footer className={styles.footer}>Updated July 13, 2026 · Sources are linked at the claim they support · For home-robot test methods, visit <a href="https://housebrokenlabs.com/resources">Housebroken Labs</a>.</footer>
    </div>
  <SiteFooter /></main>;
}
