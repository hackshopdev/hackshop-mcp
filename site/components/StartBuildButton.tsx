"use client";

import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { useState } from "react";
import { track } from "@/lib/analytics";

export function StartBuildButton({
  deviceId,
  idea,
  source,
  className,
  style,
  label = "Start this build",
}: {
  deviceId: string;
  idea?: string;
  source: string;
  className?: string;
  style?: CSSProperties;
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      className={className}
      style={style}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        // Loaded on click so pages with this button don't ship the catalog up front.
        const [{ buildPlanForDevice }, { createProjectFromPlan }, { saveProjectFor, isSignedInNow }] =
          await Promise.all([
            import("@/lib/build-plan-data"),
            import("@/lib/projects/build"),
            import("@/lib/ui/project-sync"),
          ]);
        const plan = buildPlanForDevice(deviceId);
        if (!plan) {
          setBusy(false);
          return;
        }
        track("build_started", { device_id: deviceId, source });
        const project = createProjectFromPlan({ plan, idea, source });
        const result = await saveProjectFor(project, isSignedInNow());
        track("project_saved", { synced: result.synced });
        router.push(`/projects/${result.project.id}`);
      }}
    >
      {busy ? "Starting…" : label}
    </button>
  );
}
