import Link from "next/link";
import ui from "@/components/ui.module.css";
import { getBoardModel } from "@/lib/models/boards";
import { modelStepsForDevice } from "@/lib/models/plan-steps";
import { ExplodedViewerLazy } from "./ExplodedViewerLazy";

/**
 * "See inside" section for build and board pages: the exploded 3D model of
 * the board with part lessons. Renders nothing for boards without a model.
 * Server component; the viewer itself loads on the client.
 */
export function SeeInside({ deviceId, name }: { deviceId: string; name: string }) {
  const model = getBoardModel(deviceId);
  if (!model) return null;
  const steps = modelStepsForDevice(deviceId);
  return (
    <section className={ui.section} aria-labelledby="see-inside" id="see-inside">
      <div className={ui.sectionHead}>
        <p className={ui.eyebrow}>See inside</p>
        <h2 id="see-inside">Take the {name} apart</h2>
        <p>
          Drag to turn it, pull the slider to explode it, and tap a part to learn what it does.{" "}
          <Link href={`/models/${deviceId}`}>Open the full 3D view</Link>
        </p>
      </div>
      <ExplodedViewerLazy model={model} steps={steps} />
    </section>
  );
}
