import Link from "next/link";
import ui from "@/components/ui.module.css";
import { MUSE_DESK_ORB_ASSEMBLY } from "@/lib/models/assemblies/muse-desk-orb";
import { getBoardModel } from "@/lib/models/boards";
import { modelStepsForDevice } from "@/lib/models/plan-steps";
import { ExplodedViewerLazy } from "./ExplodedViewerLazy";

/**
 * "See inside" section for build and board pages: the exploded 3D model of
 * the board with part lessons. Renders nothing for boards without a model.
 * Server component; the viewer itself loads on the client.
 */
export function SeeInside({
  deviceId,
  name,
  variant = "standard",
}: {
  deviceId: string;
  name: string;
  variant?: "standard" | "recipe";
}) {
  const isDeskOrbRecipe = variant === "recipe" && deviceId === "waveshare-esp32-s3-touch-amoled-1-75c";
  const model = isDeskOrbRecipe ? MUSE_DESK_ORB_ASSEMBLY.model : getBoardModel(deviceId);
  if (!model) return null;
  const steps = isDeskOrbRecipe ? MUSE_DESK_ORB_ASSEMBLY.steps : modelStepsForDevice(deviceId);
  return (
    <section className={ui.section} aria-labelledby="see-inside" id="see-inside">
      <div className={ui.sectionHead}>
        <p className={ui.eyebrow}>{isDeskOrbRecipe ? "Assembly model" : "See inside"}</p>
        <h2 id="see-inside">{isDeskOrbRecipe ? `Build the ${name}` : `Take the ${name} apart`}</h2>
        <p>
          {isDeskOrbRecipe
            ? "Drag to inspect the fit, explode the three physical assemblies, and follow the actual build order."
            : "Drag to turn it, pull the slider to explode it, and tap a part to learn what it does."}{" "}
          <Link href={`/models/${deviceId}`}>Open the full 3D view</Link>
        </p>
      </div>
      <ExplodedViewerLazy model={model} steps={steps} variant={variant} />
    </section>
  );
}
