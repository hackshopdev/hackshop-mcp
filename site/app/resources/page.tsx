import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import type { Metadata } from "next";
import Link from "next/link";
import { EDITORIAL_CLUSTERS, postsInCluster } from "@/lib/editorial";
import styles from "./editorial.module.css";

const DESCRIPTION =
  "Guides for giving your AI agent a body: the best Muse setups, build versus buy, your first hardware project, 3D printing options, and hardware field guides.";

export const metadata: Metadata = {
  title: "Field guides | hackshop",
  description: DESCRIPTION,
  alternates: { canonical: "/resources" },
  openGraph: { title: "Field guides | hackshop", description: DESCRIPTION, url: "/resources", images: ["/opengraph-image"] },
  twitter: { card: "summary_large_image", images: ["/opengraph-image"] },
};

export default function ResourcesPage() {
  return (
    <main className={styles.page}>
      <SiteHeader />
      <div className={styles.shell}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>Practical, source-linked guides</p>
          <h1>Give your agent a body. Know what you&apos;re getting into.</h1>
          <p>
            Plain guides for picking, building and placing a small device for your AI agent, plus field guides for
            hackable hardware. Every guide links its sources and ends with a real next step.
          </p>
        </header>
        <Link
          className={`${styles.card} ${styles.pillar}`}
          href="/muse"
          style={{ display: "block", marginBottom: 18 }}
        >
          <div className={styles.meta}>
            <span className={styles.pill}>Start here</span>
            <span className={styles.pill}>Muse gadgets</span>
          </div>
          <h2>Give Meta&apos;s Muse a body: every supported board compared</h2>
          <p>
            Which ESP32 boards and Raspberry Pis work with Meta&apos;s Muse Gadgets SDK, what each one can do, how hard
            it is to build, and a build you can start or hand to your agent.
          </p>
        </Link>
        {EDITORIAL_CLUSTERS.map((cluster) => {
          const posts = postsInCluster(cluster.id);
          if (posts.length === 0) return null;
          return (
            <section key={cluster.id} aria-labelledby={`cluster-${cluster.id}`}>
              <div className={styles.clusterHead}>
                <h2 id={`cluster-${cluster.id}`}>{cluster.title}</h2>
                <p>{cluster.blurb}</p>
              </div>
              <div className={styles.grid} style={{ paddingBottom: 24 }}>
                {posts.map((post) => (
                  <Link
                    className={`${styles.card} ${post.pillar ? styles.pillar : ""}`}
                    href={`/resources/${post.slug}`}
                    key={post.slug}
                  >
                    <div className={styles.meta}>
                      <span className={styles.pill}>
                        {post.pillar ? "Deep guide" : `${post.readingMinutes} minute guide`}
                      </span>
                      {post.tags.slice(0, 2).map((tag) => (
                        <span className={styles.pill} key={tag}>
                          {tag}
                        </span>
                      ))}
                    </div>
                    <h2>{post.title}</h2>
                    <p>{post.description}</p>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
        <footer className={styles.footer}>
          Updated October 5, 2026 · Sources are linked at the claim they support · Free tools:{" "}
          <Link href="/tools">board picker, 3D print cost calculator and more</Link> · For home-robot test methods, visit{" "}
          <a href="https://housebrokenlabs.com/resources">Housebroken Labs</a>.
        </footer>
      </div>
      <SiteFooter />
    </main>
  );
}
