import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { editorialPosts, getEditorialPost } from "@/lib/editorial";
import styles from "../editorial.module.css";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return editorialPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = getEditorialPost((await params).slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.description,
    keywords: post.tags,
    alternates: { canonical: `/resources/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      url: `/resources/${post.slug}`,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      images: ["/opengraph-image"],
    },
    twitter: { card: "summary_large_image", title: post.title, description: post.description, images: ["/opengraph-image"] },
  };
}

function longDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** JSON for a <script> tag: escape "<" so the body can't close the tag. */
function jsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export default async function ResourceArticle({ params }: Props) {
  const post = getEditorialPost((await params).slug);
  if (!post) notFound();
  const related = post.relatedSlugs
    .map(getEditorialPost)
    .filter((value): value is NonNullable<typeof value> => Boolean(value));
  const canonical = `https://www.hackshop.dev/resources/${post.slug}`;
  const reviewed = longDate(post.updatedAt);
  const graph: Record<string, unknown>[] = [
    {
      "@type": "Article",
      headline: post.title,
      description: post.description,
      datePublished: post.publishedAt,
      dateModified: post.updatedAt,
      wordCount: post.wordCount,
      mainEntityOfPage: canonical,
      author: { "@type": "Organization", name: "hackshop", url: "https://www.hackshop.dev" },
      publisher: { "@type": "Organization", name: "hackshop", url: "https://www.hackshop.dev" },
      keywords: post.tags.join(", "),
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Field guides", item: "https://www.hackshop.dev/resources" },
        { "@type": "ListItem", position: 2, name: post.title, item: canonical },
      ],
    },
  ];
  if (post.faq && post.faq.length > 0) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: post.faq.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    });
  }
  const jsonLd = { "@context": "https://schema.org", "@graph": graph };

  return (
    <main className={styles.page}>
      <SiteHeader />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonForScript(jsonLd) }} />
      <div className={styles.shell}>
        <header className={styles.articleHero}>
          <p className={styles.eyebrow}>{post.pillar ? "Deep guide" : "Field guide"}</p>
          <h1>{post.title}</h1>
          <p>{post.description}</p>
          <div className={styles.articleMeta}>
            <span>{post.readingMinutes} minute read</span>
            <span>Reviewed {reviewed}</span>
          </div>
          <div className={styles.tags}>
            {post.tags.map((tag) => (
              <span className={styles.pill} key={tag}>
                {tag}
              </span>
            ))}
          </div>
        </header>
        <div className={styles.articleLayout}>
          <article className={styles.article} dangerouslySetInnerHTML={{ __html: post.bodyHtml }} />
          <aside className={styles.sidebar}>
            <h2>Related guides</h2>
            {related.map((item) => (
              <Link href={`/resources/${item.slug}`} key={item.slug}>
                {item.title}
              </Link>
            ))}
            <p className={styles.sourceNote}>
              Sources were checked on {reviewed}. Follow each publisher for the newest revision.
            </p>
          </aside>
        </div>
        <footer className={styles.footer}>
          Educational information, not individualized legal, financial, or safety advice. Prices change; check the
          seller before you buy.
        </footer>
      </div>
      <SiteFooter />
    </main>
  );
}
