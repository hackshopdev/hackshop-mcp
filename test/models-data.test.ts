import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildPlanForDevice } from "../site/lib/build-plan-data";
import { BOARD_MODELS, getBoardModel, MODEL_DEVICE_IDS } from "../site/lib/models/boards";
import { applyExplode, buildBoard } from "../site/lib/models/build";
import { DIMENSION_SOURCES } from "../site/lib/models/sources";
import { applyMatrix, STAND_STL_BOUNDS } from "../site/lib/models/stand";
import { modelSteps, STEP_PART_KINDS } from "../site/lib/models/steps";
import type { BoardModel, ModelPart, PartKind } from "../site/lib/models/types";

const LISTED = [
  "espressif-esp32-c5-devkitc-1",
  "ideaspark-esp32-1-9-lcd",
  "seeed-sensecap-indicator",
  "seeed-reterminal-e1001",
  "seeed-reterminal-e1002",
  "home-assistant-voice-pe",
  "waveshare-esp32-s3-touch-amoled-1-75c",
  "aipi-lite",
  "waveshare-esp32-c6-touch-amoled-1-8",
  "seeed-sensecap-watcher",
  "m5stack-sticks3",
  "m5stack-stickc-plus2",
  "raspberry-pi-5",
  "raspberry-pi-4b",
  "raspberry-pi-zero-2w",
];

const KINDS: PartKind[] = [
  "shell-front", "shell-back", "glass", "screen", "pcb", "chip", "battery", "speaker",
  "mic", "camera", "button", "port", "led", "antenna", "stand", "sensor",
];

const root = process.cwd();
const platforms = JSON.parse(readFileSync(join(root, "platforms.json"), "utf8")) as Array<{
  boards: Array<{ device_id: string; features: Record<string, unknown> }>;
}>;
const featuresById = new Map(
  platforms.flatMap((platform) => platform.boards.map((board) => [board.device_id, board.features] as const)),
);
const catalog = JSON.parse(readFileSync(join(root, "catalog.json"), "utf8")) as Array<{
  id: string;
  physical?: { size_mm: { w: number | null; h: number | null; t: number | null } };
}>;
const manifest = JSON.parse(readFileSync(join(root, "site/public/cad/manifest.json"), "utf8")) as {
  parts: Array<{ device_id: string; part: string; files: { stl: string } }>;
};

function model(id: string): BoardModel {
  const found = getBoardModel(id);
  if (!found) throw new Error(`missing model ${id}`);
  return found;
}

const isBuzzer = (part: ModelPart) => part.kind === "speaker" && /buzzer/i.test(part.name);
const of = (m: BoardModel, kind: PartKind) => m.parts.filter((part) => part.kind === kind);

function readStl(path: string): number[][] {
  const buffer = readFileSync(path);
  const count = buffer.readUInt32LE(80);
  const vertices: number[][] = [];
  for (let i = 0; i < count; i += 1) {
    const offset = 84 + i * 50 + 12;
    for (let v = 0; v < 3; v += 1) {
      const at = offset + v * 12;
      vertices.push([buffer.readFloatLE(at), buffer.readFloatLE(at + 4), buffer.readFloatLE(at + 8)]);
    }
  }
  return vertices;
}

describe("board models", () => {
  it("covers every listed board, once, in the listed order", () => {
    expect([...MODEL_DEVICE_IDS]).toEqual(LISTED);
    for (const id of LISTED) expect(getBoardModel(id)?.deviceId).toBe(id);
  });

  it("gives every part a kind, a positive size, an explode offset and a short plain lesson", () => {
    for (const m of BOARD_MODELS) {
      const ids = new Set<string>();
      expect(m.parts.length, m.deviceId).toBeGreaterThanOrEqual(6);
      for (const part of m.parts) {
        const where = `${m.deviceId}/${part.id}`;
        expect(ids.has(part.id), `duplicate ${where}`).toBe(false);
        ids.add(part.id);
        expect(KINDS, where).toContain(part.kind);
        expect(part.size.every((n) => Number.isFinite(n) && n > 0), where).toBe(true);
        expect(part.position.every(Number.isFinite), where).toBe(true);
        expect(part.explode.every(Number.isFinite), where).toBe(true);
        expect(part.name.trim().length, where).toBeGreaterThan(0);
        expect(part.lesson.trim().length, where).toBeGreaterThan(10);
        const sentences = part.lesson.match(/[.!?](?=\s|$)/g)?.length ?? 0;
        expect(sentences, `${where}: ${part.lesson}`).toBeGreaterThanOrEqual(1);
        expect(sentences, `${where}: ${part.lesson}`).toBeLessThanOrEqual(3);
        expect(part.lesson, where).not.toMatch(/[—–]|!/);
        expect(part.name, where).not.toMatch(/[—–]/);
      }
    }
  });

  it("keeps collapsed parts inside the outer box", () => {
    const tolerance = 0.6;
    for (const m of BOARD_MODELS) {
      const half = [m.outer.w / 2, m.outer.h / 2, m.outer.t / 2];
      for (const part of m.parts) {
        if (part.kind === "stand") continue;
        for (let axis = 0; axis < 3; axis += 1) {
          const lo = part.position[axis]! - part.size[axis]! / 2;
          const hi = part.position[axis]! + part.size[axis]! / 2;
          const where = `${m.deviceId}/${part.id} axis ${axis}: ${lo.toFixed(2)}..${hi.toFixed(2)} vs ±${half[axis]}`;
          expect(lo, where).toBeGreaterThanOrEqual(-half[axis]! - tolerance);
          expect(hi, where).toBeLessThanOrEqual(half[axis]! + tolerance);
        }
      }
    }
  });

  it("takes outer size from the sources table and matches the catalog where it has numbers", () => {
    for (const m of BOARD_MODELS) {
      const dims = DIMENSION_SOURCES[m.deviceId];
      expect(dims, m.deviceId).toBeDefined();
      expect(m.outer.w).toBe(dims!.w.value);
      expect(m.outer.h).toBe(dims!.h.value);
      expect(m.outer.t).toBe(dims!.t.value);
      const physical = catalog.find((device) => device.id === m.deviceId)?.physical;
      for (const key of ["w", "h", "t"] as const) {
        const value = physical?.size_mm[key];
        if (typeof value === "number") expect(m.outer[key], `${m.deviceId}.${key}`).toBe(value);
      }
    }
  });

  it("records a source URL for every dimension and flags estimates", () => {
    for (const id of LISTED) {
      const dims = DIMENSION_SOURCES[id]!;
      for (const key of ["w", "h", "t"] as const) {
        const dim = dims[key];
        expect(dim.value, `${id}.${key}`).toBeGreaterThan(0);
        const sourced = /^https:\/\//.test(dim.url);
        expect(sourced || dim.approx === true, `${id}.${key}`).toBe(true);
        if (dim.approx) expect(dim.note?.length ?? 0, `${id}.${key} needs a note`).toBeGreaterThan(10);
      }
      expect(model(id).sources.length).toBeGreaterThan(0);
      for (const url of model(id).sources) expect(url).toMatch(/^https:\/\//);
    }
  });
});

describe("board models match the catalog features", () => {
  it("puts a camera only where the catalog says there is one", () => {
    for (const id of LISTED) {
      const hasCamera = featuresById.get(id)?.camera === true;
      expect(of(model(id), "camera").length > 0, id).toBe(hasCamera);
    }
    expect(LISTED.filter((id) => of(model(id), "camera").length > 0)).toEqual(["seeed-sensecap-watcher"]);
  });

  it("matches battery yes, optional and no", () => {
    for (const id of LISTED) {
      const battery = featuresById.get(id)?.battery;
      const parts = of(model(id), "battery");
      if (battery === "yes") {
        expect(parts.length, id).toBe(1);
        expect(parts[0]!.optional ?? false, id).toBe(false);
      } else if (battery === "optional") {
        expect(parts.length, id).toBe(1);
        expect(parts[0]!.optional, id).toBe(true);
      } else {
        expect(parts.length, `${id} has battery ${String(battery)}`).toBe(0);
      }
    }
  });

  it("matches speaker, buzzer and microphone", () => {
    for (const id of LISTED) {
      const audio = featuresById.get(id)?.audio;
      const m = model(id);
      const speakers = of(m, "speaker").filter((part) => !isBuzzer(part));
      const buzzers = of(m, "speaker").filter(isBuzzer);
      const mics = of(m, "mic");
      if (audio === "speaker-mic") {
        expect(speakers.length, id).toBe(1);
        expect(buzzers.length, id).toBe(0);
        expect(mics.length, id).toBeGreaterThan(0);
      } else if (audio === "buzzer-mic") {
        expect(speakers.length, id).toBe(0);
        expect(buzzers.length, id).toBe(1);
        expect(mics.length, id).toBeGreaterThan(0);
      } else {
        expect(speakers.length, id).toBe(0);
        expect(mics.length, id).toBe(0);
      }
    }
  });

  it("matches screen presence, size class and type", () => {
    for (const id of LISTED) {
      const features = featuresById.get(id) ?? {};
      const screens = of(model(id), "screen");
      const hasDisplay =
        typeof features.display_in === "number" ||
        (typeof features.images === "string" && features.images !== "none");
      expect(screens.length, id).toBe(hasDisplay ? 1 : 0);
      if (!hasDisplay) continue;
      const screen = screens[0]!;
      if (typeof features.display_in === "number") {
        const inches = Number(screen.name.match(/([\d.]+)"/)?.[1]);
        expect(Math.abs(inches - features.display_in), `${id} ${screen.name}`).toBeLessThanOrEqual(0.06);
      }
      if (features.round_display === true) expect(screen.shape, id).toBe("cylinder");
      if (id.includes("reterminal")) {
        expect(screen.name, id).toMatch(/e-paper/);
        expect(screen.display, id).toBe(features.images === "color" ? "epaper-color" : "epaper-bw");
      } else if (id.startsWith("waveshare")) {
        expect(screen.name, id).toMatch(/AMOLED/);
      } else {
        expect(`${screen.name} ${screen.lesson}`, id).toMatch(/LCD|touchscreen/);
      }
      if (features.touch === true) {
        expect(model(id).parts.some((part) => /touch/i.test(part.name)), `${id} touch`).toBe(true);
      }
    }
  });

  it("models air sensors only on the Indicator, and Linux boards with no screen, battery or audio", () => {
    for (const id of LISTED) {
      const features = featuresById.get(id) ?? {};
      const air = model(id).parts.some((part) => part.kind === "sensor" && /CO2/.test(part.name));
      expect(air, id).toBe(features.air_sensors === true);
    }
    for (const id of ["raspberry-pi-5", "raspberry-pi-4b", "raspberry-pi-zero-2w"]) {
      const kinds = new Set(model(id).parts.map((part) => part.kind));
      for (const kind of ["screen", "battery", "speaker", "mic", "camera"] as const) {
        expect(kinds.has(kind), `${id} ${kind}`).toBe(false);
      }
    }
  });
});

describe("printable stands", () => {
  const withStand = [...new Set(manifest.parts.map((part) => part.device_id))].filter((id) =>
    LISTED.includes(id),
  );

  it("loads the manifest STL as the stand part for each board that has one", () => {
    expect(withStand.length).toBeGreaterThan(0);
    for (const id of LISTED) {
      const stands = model(id).parts.filter((part) => part.stl);
      const entry = manifest.parts.find((part) => part.device_id === id && part.part === "desk-stand");
      if (!entry) {
        expect(stands.length, id).toBe(0);
        continue;
      }
      expect(stands.length, id).toBe(1);
      expect(stands[0]!.kind).toBe("stand");
      expect(stands[0]!.stl).toBe(entry.files.stl);
      expect(stands[0]!.stlMatrix?.length).toBe(16);
      expect(existsSync(join(root, "site/public", entry.files.stl))).toBe(true);
    }
  });

  it("has STL bounds that match the files and a pose that cradles the board", () => {
    for (const id of withStand) {
      const entry = manifest.parts.find((part) => part.device_id === id)!;
      const vertices = readStl(join(root, "site/public", entry.files.stl));
      const min = [0, 1, 2].map((axis) => Math.min(...vertices.map((v) => v[axis]!)));
      const max = [0, 1, 2].map((axis) => Math.max(...vertices.map((v) => v[axis]!)));
      const bounds = STAND_STL_BOUNDS[id]!;
      for (let axis = 0; axis < 3; axis += 1) {
        expect(Math.abs(min[axis]! - bounds.min[axis]!), `${id} min ${axis}`).toBeLessThan(0.01);
        expect(Math.abs(max[axis]! - bounds.max[axis]!), `${id} max ${axis}`).toBeLessThan(0.01);
      }

      const m = model(id);
      const stand = m.parts.find((part) => part.stl)!;
      const half = [m.outer.w / 2, m.outer.h / 2, m.outer.t / 2];
      const placed = vertices.map((v) => applyMatrix(stand.stlMatrix!, v as [number, number, number]));
      const inside = placed.filter((p) => {
        if (m.outer.shape === "round") {
          return Math.hypot(p[0], p[1]) < half[0]! - 1 && Math.abs(p[2]) < half[2]! - 1;
        }
        return p.every((value, axis) => Math.abs(value) < half[axis]! - 1);
      });
      expect(inside.length, `${id} stand vertices inside the board`).toBe(0);
      const lowest = Math.min(...placed.map((p) => p[1]));
      expect(lowest, `${id} stand reaches below the board`).toBeLessThan(-half[1]!);
      const near = placed.filter((p) => Math.abs(p[2] + half[2]!) < 2.5 || Math.abs(p[1] + half[1]!) < 2.5);
      expect(near.length, `${id} stand touches the board`).toBeGreaterThan(0);
    }
  });
});

describe("3D builder", () => {
  it("turns each model into a group with one named mesh per part", () => {
    for (const m of BOARD_MODELS) {
      const built = buildBoard(m);
      expect(built.group.name).toBe(m.deviceId);
      expect(built.parts.size).toBe(m.parts.length);
      for (const part of m.parts) {
        const mesh = built.group.getObjectByName(part.id);
        expect(mesh, `${m.deviceId}/${part.id}`).toBeDefined();
      }
    }
  });

  it("moves parts by their explode offset", () => {
    const m = model("m5stack-sticks3");
    const built = buildBoard(m);
    applyExplode(built, 1);
    for (const part of m.parts) {
      const mesh = built.parts.get(part.id)!.mesh;
      expect(mesh.position.x).toBeCloseTo(part.position[0] + part.explode[0]);
      expect(mesh.position.z).toBeCloseTo(part.position[2] + part.explode[2]);
    }
    applyExplode(built, 0);
    const lcd = built.parts.get("lcd")!.mesh;
    expect(lcd.position.z).toBeCloseTo(m.parts.find((p) => p.id === "lcd")!.position[2]);
  });
});

describe("assembly steps", () => {
  it("maps every build-plan step to parts that exist on the model", () => {
    for (const id of LISTED) {
      const m = model(id);
      const plan = buildPlanForDevice(id);
      expect(plan, id).not.toBeNull();
      const steps = modelSteps(m, plan!.assembly);
      expect(steps.length, id).toBe(plan!.assembly.length);
      const partIds = new Set(m.parts.map((part) => part.id));
      for (const step of steps) {
        expect(step.partIds.length, `${id} ${step.id}`).toBeGreaterThan(0);
        for (const partId of step.partIds) expect(partIds.has(partId), `${id} ${step.id} ${partId}`).toBe(true);
        const kinds = new Set(step.partIds.map((partId) => m.parts.find((p) => p.id === partId)!.kind));
        const allowed = new Set<PartKind>([...STEP_PART_KINDS[step.action as keyof typeof STEP_PART_KINDS], "chip", "pcb"]);
        for (const kind of kinds) expect(allowed.has(kind), `${id} ${step.id} ${kind}`).toBe(true);
      }
    }
  });

  it("highlights the printed stand for print steps and the SD slot for Linux insert steps", () => {
    const sticks = modelSteps(model("m5stack-sticks3"), buildPlanForDevice("m5stack-sticks3")!.assembly);
    expect(sticks.find((step) => step.action === "print")?.partIds).toEqual(["printed-stand"]);
    const pi = modelSteps(model("raspberry-pi-5"), buildPlanForDevice("raspberry-pi-5")!.assembly);
    expect(pi.find((step) => step.action === "insert")?.partIds).toEqual(["microsd"]);
    const pair = modelSteps(model("home-assistant-voice-pe"), buildPlanForDevice("home-assistant-voice-pe")!.assembly)
      .find((step) => step.action === "pair");
    expect(pair?.partIds).toContain("center-button");
  });
});
