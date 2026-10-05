import wave2Posts from "../../content/editorial/wave2-content.json";
import wave3Posts from "../../content/editorial/wave3-content.json";

export type EditorialPost = {
  number: number;
  title: string;
  slug: string;
  job: string;
  pillar: boolean;
  tags: string[];
  tweet: string;
  video: string;
  description: string;
  publishedAt: string;
  updatedAt: string;
  relatedSlugs: string[];
  sources: Array<{ label: string; url: string }>;
  bodyHtml: string;
  wordCount: number;
  readingMinutes: number;
  /** Question and answer pairs shown in the article and as FAQPage data. */
  faq?: Array<{ q: string; a: string }>;
  primaryKeyword?: string;
  /** Topic group for the resources index. */
  cluster?: EditorialCluster;
};

export type EditorialCluster = "agent-body" | "muse" | "build-buy" | "field-guides";

export const EDITORIAL_CLUSTERS: Array<{ id: EditorialCluster; title: string; blurb: string }> = [
  {
    id: "agent-body",
    title: "Give your AI agent a body",
    blurb: "What a physical body for your agent is, what it can and can't do, and how to build one in an afternoon.",
  },
  {
    id: "muse",
    title: "Best setups for Meta's Muse",
    blurb: "Which board to put Muse on, side-by-side comparisons, and the limits and terms to know first.",
  },
  {
    id: "build-buy",
    title: "Build, buy or print",
    blurb: "Build versus buy, open versus closed, your first hardware project, and how to get parts 3D printed.",
  },
  {
    id: "field-guides",
    title: "Hardware field guides",
    blurb: "Choosing, checking, flashing, recovering and repurposing hackable hardware.",
  },
];

export const editorialPosts: EditorialPost[] = [
  ...(wave3Posts as EditorialPost[]),
  ...(wave2Posts as EditorialPost[]).map((post) => ({ ...post, cluster: post.cluster ?? ("field-guides" as const) })),
];

export const postsInCluster = (cluster: EditorialCluster) =>
  editorialPosts.filter((post) => post.cluster === cluster).sort((a, b) => Number(b.pillar) - Number(a.pillar) || a.number - b.number);
export const getEditorialPost = (slug: string) => editorialPosts.find((post) => post.slug === slug);
