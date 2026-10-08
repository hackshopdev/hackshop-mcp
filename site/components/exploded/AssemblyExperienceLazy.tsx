"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { AssemblyPackage } from "@/lib/models/assembly-package";
import styles from "./exploded.module.css";

function Skeleton() {
  return (
    <div className={styles.skeleton} aria-busy="true">
      Loading 3D build
    </div>
  );
}

const AssemblyExperience = dynamic(() => import("./AssemblyExperience").then((mod) => mod.AssemblyExperience), {
  ssr: false,
  loading: () => <Skeleton />,
});

/** Loads three.js and the assembly experience only when it scrolls near the screen. */
export function AssemblyExperienceLazy({ pkg }: { pkg: AssemblyPackage }) {
  const [near, setNear] = useState(false);
  const holder = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = holder.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          setNear(true);
        }
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={holder} data-assembly-package={pkg.id}>
      {near ? <AssemblyExperience pkg={pkg} /> : <Skeleton />}
    </div>
  );
}
