import Link from "next/link";
import ui from "@/components/ui.module.css";
import { MUSE_DESK_ORB_PACKAGE } from "@/lib/models/assemblies/muse-desk-orb";
import { RESPEAKER_VOICE_NODE_ASSEMBLY } from "@/lib/models/assemblies/respeaker-voice-node";
import { getBoardModel } from "@/lib/models/boards";
import { modelStepsForDevice } from "@/lib/models/plan-steps";
import { AssemblyExperienceLazy } from "./AssemblyExperienceLazy";
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
  if (variant === "recipe" && deviceId === "waveshare-esp32-s3-touch-amoled-1-75c") {
    return (
      <section className={ui.section} aria-labelledby="see-inside" id="see-inside">
        <div className={ui.sectionHead}>
          <p className={ui.eyebrow}>Assembly model</p>
          <h2 id="see-inside">Build the {name}</h2>
          <p>
            Orbit the finished build, walk the three build steps, and trace power, data and Muse&apos;s voice and reply
            paths. The purchased Orb stays sealed: only its published exterior is shown.
          </p>
        </div>
        <AssemblyExperienceLazy pkg={MUSE_DESK_ORB_PACKAGE} />
      </section>
    );
  }
  const recipeAssembly =
    variant === "recipe" && deviceId === "seeed-respeaker-lite-xiao-esp32s3" ? RESPEAKER_VOICE_NODE_ASSEMBLY : null;
  const model = recipeAssembly?.model ?? getBoardModel(deviceId);
  if (!model) return null;
  const steps = recipeAssembly?.steps ?? modelStepsForDevice(deviceId);
  const isRecipe = recipeAssembly !== null;
  return (
    <section className={ui.section} aria-labelledby="see-inside" id="see-inside">
      <div className={ui.sectionHead}>
        <p className={ui.eyebrow}>{isRecipe ? "Assembly model" : "See inside"}</p>
        <h2 id="see-inside">{isRecipe ? `Build the ${name}` : `Take the ${name} apart`}</h2>
        <p>
          {isRecipe
            ? `Drag to inspect the fit, explode the ${recipeAssembly.groups.length} physical assemblies, and follow the actual build order.`
            : "Drag to turn it, pull the slider to explode it, and tap a part to learn what it does."}{" "}
          {!isRecipe ? <Link href={`/models/${deviceId}`}>Open the full 3D view</Link> : null}
        </p>
      </div>
      <ExplodedViewerLazy model={model} steps={steps} variant={variant} />
    </section>
  );
}
