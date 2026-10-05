"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
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
export function ExplodedViewerLazy({ model, steps }: { model: BoardModel; steps?: ModelStep[] }) {
  const [support, setSupport] = useState<"checking" | "yes" | "no">("checking");
  const [reason, setReason] = useState<string | undefined>();

  useEffect(() => {
    setSupport(hasWebGL() ? "yes" : "no");
  }, []);

  if (support === "no") return <ModelFallback model={model} reason={reason} />;
  if (support === "checking") return <ViewerSkeleton />;
  return (
    <ExplodedViewer
      model={model}
      steps={steps}
      onUnavailable={(message) => {
        setReason(message);
        setSupport("no");
      }}
    />
  );
}
