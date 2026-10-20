import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("hardware render interaction", () => {
  it("ships three original schematic scenes, not precision CAD or physical evidence", async () => {
    const { buildHardwareScene, disposeHardwareScene } = await import("../site/lib/hardware-preview");
    for (const kind of ["frame", "home", "remote"] as const) {
      const model = buildHardwareScene(kind, false);
      expect(model.userData.evidence).toBe("schematic-render");
      expect(model.userData.kind).toBe(kind);
      expect(model.children.length).toBeGreaterThan(5);
      expect(model.getObjectByName("signal")).toBeDefined();
      const active = buildHardwareScene(kind, true);
      expect(active.getObjectByName("signal")!.userData.active).toBe(true);
      expect(model.getObjectByName("signal")!.userData.active).toBe(false);
      disposeHardwareScene(model);
      disposeHardwareScene(active);
    }
  });

  it("defers Three.js until requested and offers keyboard controls, reset, and a WebGL fallback", () => {
    const shell = readFileSync(join(process.cwd(), "site/components/hardware/HardwarePreview.tsx"), "utf8");
    expect(shell).toContain("dynamic(");
    expect(shell).toContain("ssr: false");
    expect(shell).toContain("useState(false)");
    expect(shell).toContain("Open interactive render");
    const viewer = readFileSync(join(process.cwd(), "site/components/hardware/HardwareScene.tsx"), "utf8");
    expect(viewer).toContain("OrbitControls");
    expect(viewer).toContain("Reset view");
    expect(viewer).toContain("Rotate left");
    expect(viewer).toContain("Zoom in");
    expect(viewer).toContain("WebGL");
    expect(viewer).toContain("ResizeObserver");
    expect(viewer).toContain("webglcontextlost");
    expect(viewer).not.toContain("setAnimationLoop");
    expect(viewer).not.toContain("autoRotate = true");
  });
});
