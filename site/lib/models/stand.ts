import type { BoardModel, ModelPart, Vec3 } from "./types";

// Places hackshop's printable desk stands (site/public/cad) in a board's
// model frame. The pose mirrors sim-worker/hackshop_sim/cad/stand.py: the
// board's front-bottom edge sits at (0, 12, device_z) in the STL frame
// (Z up, board front facing -Y), tilted back by `tilt_deg`.

export interface StandParams {
  tilt_deg: number;
  clearance: number;
  wall: number;
  base_thickness: number;
  plug_overmold: [number, number];
  plug_length: number;
}

/** Defaults from stand.py; every fab.json in site/public/cad uses them. */
export const DEFAULT_STAND_PARAMS: StandParams = {
  tilt_deg: 15,
  clearance: 0.4,
  wall: 3,
  base_thickness: 4,
  plug_overmold: [12.5, 7],
  plug_length: 22,
};

/** Front-bottom edge of the board in the STL frame, per stand.py _make_pose. */
export function standOrigin(
  dims: { t: number },
  usbFace: "bottom" | "left" | "right" | null,
  params: StandParams = DEFAULT_STAND_PARAMS,
): [number, number, number] {
  const theta = (params.tilt_deg * Math.PI) / 180;
  const deviceY = 12;
  let deviceZ: number;
  if (usbFace === "bottom") {
    const plugThickness = params.plug_overmold[1];
    deviceZ =
      params.base_thickness +
      params.plug_length * Math.cos(theta) +
      2 +
      (dims.t / 2 + plugThickness / 2) * Math.sin(theta);
  } else {
    const shelfThick = Math.max(params.wall, 3);
    deviceZ =
      params.base_thickness +
      shelfThick * Math.cos(theta) +
      (dims.t + params.clearance) * Math.sin(theta) +
      0.5;
  }
  return [0, deviceY, deviceZ];
}

/**
 * Row-major 4x4 matrix from STL coordinates to the board frame
 * (x right, y up, z out of the front face, origin at the outer box centre).
 */
export function standMatrix(
  dims: { h: number; t: number },
  usbFace: "bottom" | "left" | "right" | null,
  params: StandParams = DEFAULT_STAND_PARAMS,
): number[] {
  const theta = (params.tilt_deg * Math.PI) / 180;
  const s = Math.sin(theta);
  const c = Math.cos(theta);
  const [, oy, oz] = standOrigin(dims, usbFace, params);
  // Board-local depth y_d = c(Py-oy) - s(Pz-oz), height z_d = s(Py-oy) + c(Pz-oz).
  // Model frame: X = Px, Y = z_d - h/2, Z = t/2 - y_d.
  return [
    1, 0, 0, 0,
    0, s, c, -(s * oy + c * oz) - dims.h / 2,
    0, -c, s, dims.t / 2 + c * oy - s * oz,
    0, 0, 0, 1,
  ];
}

export function applyMatrix(m: number[], p: Vec3): Vec3 {
  return [
    m[0]! * p[0] + m[1]! * p[1] + m[2]! * p[2] + m[3]!,
    m[4]! * p[0] + m[5]! * p[1] + m[6]! * p[2] + m[7]!,
    m[8]! * p[0] + m[9]! * p[1] + m[10]! * p[2] + m[11]!,
  ];
}

/** Axis-aligned bounds of a transformed box, as size and centre. */
export function transformedBounds(
  m: number[],
  min: Vec3,
  max: Vec3,
): { size: Vec3; center: Vec3 } {
  const lo: Vec3 = [Infinity, Infinity, Infinity];
  const hi: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const x of [min[0], max[0]]) {
    for (const y of [min[1], max[1]]) {
      for (const z of [min[2], max[2]]) {
        const p = applyMatrix(m, [x, y, z]);
        for (let i = 0; i < 3; i += 1) {
          lo[i] = Math.min(lo[i]!, p[i]!);
          hi[i] = Math.max(hi[i]!, p[i]!);
        }
      }
    }
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    size: [round(hi[0] - lo[0]), round(hi[1] - lo[1]), round(hi[2] - lo[2])],
    center: [round((hi[0] + lo[0]) / 2), round((hi[1] + lo[1]) / 2), round((hi[2] + lo[2]) / 2)],
  };
}

/**
 * STL bounding boxes (mm, STL frame) of the printable stands, measured from
 * the files in site/public/cad. test/models-data.test.ts re-measures them.
 */
export const STAND_STL_BOUNDS: Record<string, { min: Vec3; max: Vec3 }> = {
  "m5stack-sticks3": { min: [-16, 0, 0], max: [16, 45, 53.93] },
  "m5stack-stickc-plus2": { min: [-16, 0, 0], max: [16, 43.5, 54.124] },
  "waveshare-esp32-c6-touch-amoled-1-8": { min: [-22.8, 0, 0], max: [15.8, 45, 33.594] },
  "waveshare-esp32-s3-touch-amoled-1-75c": { min: [-22, 0, 0], max: [22, 45.05, 57.981] },
};

export function standStlUrl(deviceId: string): string {
  return `/cad/${deviceId}/desk-stand.stl`;
}

/** The printable desk stand as a model part, posed under the board. */
export function printedStandPart(args: {
  deviceId: string;
  outer: { h: number; t: number };
  usbFace: "bottom" | "left" | "right";
  explode: Vec3;
}): ModelPart {
  const bounds = STAND_STL_BOUNDS[args.deviceId];
  if (!bounds) throw new Error(`No printable stand bounds for ${args.deviceId}`);
  const matrix = standMatrix(args.outer, args.usbFace);
  const box = transformedBounds(matrix, bounds.min, bounds.max);
  const cable =
    args.usbFace === "bottom"
      ? "A slot under the board leaves room for a straight USB-C plug."
      : `The ${args.usbFace} edge stays open for the USB-C cable.`;
  return {
    id: "printed-stand",
    name: "Printed desk stand",
    kind: "stand",
    shape: "box",
    size: box.size,
    position: box.center,
    color: "#292e38",
    explode: args.explode,
    lesson: `A desk stand you can 3D print from hackshop's STL. It tilts the board back 15 degrees. ${cable}`,
    finish: "plastic",
    stl: standStlUrl(args.deviceId),
    stlMatrix: matrix,
  };
}

/**
 * Degrees to tip an upright board back so its printed stand sits level, or 0
 * when the board has no printed stand.
 */
export function displayTiltFor(model: BoardModel): number {
  if (model.orientation !== "upright") return 0;
  return model.parts.some((part) => part.stlMatrix) ? DEFAULT_STAND_PARAMS.tilt_deg : 0;
}
