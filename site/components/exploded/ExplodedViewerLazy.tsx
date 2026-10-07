"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { BoardModel, ModelStep } from "@/lib/models/types";
import styles from "./exploded.module.css";
import { ModelFallback } from "./ModelFallback";

function ViewerSkeleton() {
  return (
    <div className={styles.skeleton} aria-busy="true">
      Loading 3D model
    </div>
  );
}

const ExplodedViewer = dynamic(() => import("./ExplodedViewer").then((mod) => mod.ExplodedViewer), {
  ssr: false,
  loading: () => <ViewerSkeleton />,
});

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return Boolean(gl);
  } catch {
    return false;
  }
}

/**
 * Client-only exploded board viewer, loaded on demand. Pass the board model
 * from site/lib/models (getBoardModel) and, optionally, the build steps from
 * modelStepsForDevice (site/lib/models/plan-steps, server side).
 */
export function ExplodedViewerLazy({
  model,
  steps,
  variant = "standard",
}: {
  model: BoardModel;
  steps?: ModelStep[];
  variant?: "standard" | "recipe";
}) {
  const [support, setSupport] = useState<"checking" | "yes" | "no">("checking");
  const [reason, setReason] = useState<string | undefined>();
  const holder = useRef<HTMLDivElement | null>(null);

  // Load three.js only when the viewer scrolls near the screen.
  useEffect(() => {
    const node = holder.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setSupport(hasWebGL() ? "yes" : "no");
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          setSupport(hasWebGL() ? "yes" : "no");
        }
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  if (support === "no") return <ModelFallback model={model} reason={reason} />;
  if (support === "checking") {
    return (
      <div ref={holder}>
        <ViewerSkeleton />
      </div>
    );
  }
  return (
    <ExplodedViewer
      model={model}
      steps={steps}
      variant={variant}
      onUnavailable={(message) => {
        setReason(message);
        setSupport("no");
      }}
    />
  );
}
