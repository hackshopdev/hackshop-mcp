"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { HardwareGuideMediaRecord } from "@/lib/hardware-media";
import styles from "./hardware-media.module.css";

const HardwareScene = dynamic(() => import("./HardwareScene"), {
  ssr: false,
  loading: () => <p role="status">Loading the interactive render…</p>,
});

export function HardwarePreview({ preview }: { preview: HardwareGuideMediaRecord["preview"] }) {
  const [opened, setOpened] = useState(false);
  return (
    <section className={styles.preview} aria-label="Interactive Three.js render">
      <div className={styles.renderLabel}>Interactive render · Three.js</div>
      <h2>{preview.title}</h2>
      <p>{preview.description}</p>
      <p className={styles.disclaimer}>{preview.disclaimer}</p>
      {opened ? <HardwareScene kind={preview.kind} /> : (
        <div className={styles.previewClosed}>
          <p>Explore the shape and a sample interaction in 3D.</p>
          <button type="button" onClick={() => setOpened(true)}>Open interactive render</button>
          <p>Loads only when requested. No external assets or device connections.</p>
        </div>
      )}
    </section>
  );
}
