import Link from "next/link";
import { ProductTile } from "@/components/ProductTile";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { ExplodedViewerLazy } from "@/components/exploded/ExplodedViewerLazy";
import { formatOuter } from "@/components/exploded/labels";
import ui from "@/components/ui.module.css";
import { hasImage } from "@/lib/image-sources";
import { BOARD_MODELS, getBoardModel } from "@/lib/models/boards";
import { modelStepsForDevice } from "@/lib/models/plan-steps";
import { pageMetadata } from "@/lib/page-metadata";
import styles from "./models.module.css";

export const metadata = pageMetadata(
  "See inside every Muse board · Hackshop",
  "Interactive 3D models of every board hackshop lists for Muse Gadgets. Turn each one, pull it apart, and read what every part does.",
  "/models",
);

const FEATURED_ID = "m5stack-sticks3";

export default function ModelsPage() {
  const featured = getBoardModel(FEATURED_ID);
  return (
    <main className={ui.page}>
      <SiteHeader />
      <div className={ui.shell}>
        <p className={styles.crumbs}>
          <Link href="/muse">Muse gadgets</Link> / 3D models
        </p>
        <section className={styles.hero}>
          <p className={ui.eyebrow}>3D models</p>
          <h1>See inside every Muse board</h1>
          <p className={styles.intro}>
            Each board hackshop lists for Muse Gadgets, as a 3D model you can turn and pull apart. Tap a part to
            see what it does: the chip that runs Muse, the screen, the battery, the buttons. The outer size is to
            scale, so you know how big it is before you buy.
          </p>
        </section>

        <ul className={styles.grid}>
          {BOARD_MODELS.map((model) => (
            <li key={model.deviceId}>
              <Link className={styles.card} href={`/models/${model.deviceId}`}>
                <ProductTile deviceId={model.deviceId} name={model.name} hasPhoto={hasImage(model.deviceId)} />
                <div className={styles.cardBody}>
                  <h2>{model.name}</h2>
                  <p className={styles.meta}>
                    {model.parts.length} parts · {formatOuter(model)}
                  </p>
                  <span className={styles.cta}>See inside</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>

        {featured ? (
          <section className={ui.section} aria-labelledby="try-one">
            <div className={ui.sectionHead}>
              <p className={ui.eyebrow}>Try one here</p>
              <h2 id="try-one">Pull apart the {featured.name}</h2>
              <p>
                Press Explode, drag to turn it, and tap a part. The printed stand comes from hackshop&apos;s own STL.
              </p>
            </div>
            <ExplodedViewerLazy model={featured} steps={modelStepsForDevice(FEATURED_ID)} />
          </section>
        ) : null}
      </div>
      <div style={{ height: 72 }} />
      <SiteFooter />
    </main>
  );
}
