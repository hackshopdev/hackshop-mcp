import Link from "next/link";
import { notFound } from "next/navigation";
import { ExplodedViewerLazy } from "@/components/exploded/ExplodedViewerLazy";
import { KIND_LABELS, MODEL_NOTE, formatOuter } from "@/components/exploded/labels";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import ui from "@/components/ui.module.css";
import { boardSlug } from "@/lib/board-slugs";
import { getBoardModel, MODEL_DEVICE_IDS } from "@/lib/models/boards";
import { modelStepsForDevice } from "@/lib/models/plan-steps";
import { DIMENSION_SOURCES } from "@/lib/models/sources";
import { pageMetadata } from "@/lib/page-metadata";
import styles from "../models.module.css";

type Props = { params: Promise<{ deviceId: string }> };

const SITE_URL = "https://www.hackshop.dev";

export const dynamicParams = false;

export function generateStaticParams() {
  return MODEL_DEVICE_IDS.map((deviceId) => ({ deviceId }));
}

export async function generateMetadata({ params }: Props) {
  const { deviceId } = await params;
  const model = getBoardModel(deviceId);
  if (!model) return {};
  return pageMetadata(
    `${model.name} exploded view · Hackshop`,
    `See inside the ${model.name}: an interactive 3D model with ${model.parts.length} parts, each with a short note on what it does. Outer size ${formatOuter(model)}.`,
    `/models/${deviceId}`,
  );
}

const DIM_LABELS = { w: "Width", h: "Height", t: "Thickness" } as const;

export default async function ModelPage({ params }: Props) {
  const { deviceId } = await params;
  const model = getBoardModel(deviceId);
  if (!model) notFound();
  const steps = modelStepsForDevice(deviceId);
  const slug = boardSlug(deviceId);
  const dims = DIMENSION_SOURCES[deviceId];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "3D models", item: `${SITE_URL}/models` },
      { "@type": "ListItem", position: 2, name: model.name, item: `${SITE_URL}/models/${deviceId}` },
    ],
  };

  return (
    <main className={ui.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader />
      <div className={ui.shell}>
        <p className={styles.crumbs}>
          <Link href="/models">3D models</Link> / {model.name}
        </p>
        <section className={styles.hero}>
          <p className={ui.eyebrow}>Exploded view</p>
          <h1>{model.name} exploded view</h1>
          <p className={styles.intro}>
            Turn it, pull it apart, and tap any part to see what it does. Outer size: {formatOuter(model)}.
          </p>
          <div className={styles.links}>
            <Link className={ui.linkArrow} href={`/build/${deviceId}`}>
              See the build steps
            </Link>
            {slug ? (
              <Link className={ui.linkArrow} href={`/muse/${slug}`}>
                Board page: features and parts
              </Link>
            ) : null}
            <Link className={ui.linkArrow} href="/models">
              All 3D models
            </Link>
          </div>
        </section>

        <div className={styles.viewerWrap}>
          <ExplodedViewerLazy model={model} steps={steps} />
        </div>

        <section className={ui.section} aria-labelledby="inside">
          <div className={styles.sectionGrid}>
            <div>
              <div className={ui.sectionHead}>
                <p className={ui.eyebrow}>Parts</p>
                <h2 id="inside">What&apos;s inside the {model.name}</h2>
                <p>{MODEL_NOTE}</p>
              </div>
              <ul className={styles.lessons}>
                {model.parts.map((part) => (
                  <li key={part.id}>
                    <h3>
                      {part.name}
                      <span className={styles.kind}>{KIND_LABELS[part.kind]}</span>
                      {part.optional ? <span className={styles.flag}>optional</span> : null}
                    </h3>
                    <p>{part.lesson}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className={ui.sectionHead}>
                <p className={ui.eyebrow}>Size</p>
                <h2 id="size">Measurements and sources</h2>
                <p>Numbers marked approximate are estimates; everything else comes from the linked page or drawing.</p>
              </div>
              {dims ? (
                <table className={styles.dimTable}>
                  <thead>
                    <tr>
                      <th scope="col">Side</th>
                      <th scope="col">Size</th>
                      <th scope="col">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(["w", "h", "t"] as const).map((key) => {
                      const dim = dims[key];
                      return (
                        <tr key={key}>
                          <th scope="row">{DIM_LABELS[key]}</th>
                          <td className={styles.dimValue}>
                            {dim.value} mm{dim.approx ? " (approx.)" : ""}
                          </td>
                          <td>
                            <a href={dim.url} target="_blank" rel="noreferrer">
                              {hostOf(dim.url)}
                            </a>
                            {dim.note ? <span className={styles.dimNote}>{dim.note}</span> : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : null}
              <ul className={styles.sources}>
                {model.sources.map((url) => (
                  <li key={url}>
                    <a href={url} target="_blank" rel="noreferrer">
                      {url.replace(/^https:\/\//, "")}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </div>
      <div style={{ height: 72 }} />
      <SiteFooter />
    </main>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
