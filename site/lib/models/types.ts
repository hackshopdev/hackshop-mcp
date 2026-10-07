// Data model for the exploded 3D board views (/models).
//
// Coordinates are millimetres in the board's own frame, centred on the outer
// box: x runs across the width (right is +x), y runs up the height (up is +y),
// and z runs through the thickness with the front face (screen, LED ring or
// component side) at +z. Flat boards (dev boards, Raspberry Pis, the HA puck)
// use the same frame; the viewer lays them down so +z points up.

export type PartKind =
  | "shell-front"
  | "shell-back"
  | "glass"
  | "screen"
  | "pcb"
  | "chip"
  | "battery"
  | "speaker"
  | "mic"
  | "camera"
  | "button"
  | "port"
  | "led"
  | "antenna"
  | "cable"
  | "stand"
  | "sensor";

export type PartShape = "box" | "roundedBox" | "cylinder" | "tube";

export type Vec3 = [number, number, number];

/** Surface look used by the 3D builder. Defaults by kind when omitted. */
export type PartFinish =
  | "plastic"
  | "metal"
  | "glass"
  | "pcb"
  | "chip"
  | "screen"
  | "epaper"
  | "rubber"
  | "led";

/** What a screen part shows in the model. */
export type ScreenContent = "avatar" | "status" | "epaper-bw" | "epaper-color";

/** A hole through a plate, centred at `offset` in the part's x/y plane. */
export interface Cutout {
  shape: "rect" | "circle";
  /** Width and height (or diameter twice) in mm. */
  size: [number, number];
  offset?: [number, number];
  /** Corner radius for rect cutouts. */
  radius?: number;
}

export interface ModelPart {
  id: string;
  name: string;
  kind: PartKind;
  shape: PartShape;
  /** Bounding size in mm, in the board frame: [x, y, z]. */
  size: Vec3;
  /** Centre position in mm when collapsed. */
  position: Vec3;
  color: string;
  /** Offset in mm applied at 100% explode. */
  explode: Vec3;
  /** 1-3 short, plain sentences. */
  lesson: string;
  /** Size or position is a simplified guess, not a measured value. */
  approx?: boolean;
  /** The part is an optional add-on (sold separately or a variant). */
  optional?: boolean;
  /** External build piece that intentionally sits outside the device envelope. */
  external?: boolean;
  finish?: PartFinish;
  /** Corner radius in the x/y plane for roundedBox. */
  radius?: number;
  /** Cylinder axis; defaults to z (facing the viewer). */
  axis?: "x" | "y" | "z";
  /** Local centreline used by tube parts such as external cables. */
  path?: Vec3[];
  /** Tube radius in millimetres. */
  thickness?: number;
  /**
   * Turns a roundedBox or cylinder into a shell: walls of this thickness,
   * plus an optional floor on the back (-z) or front (+z) side.
   */
  hollow?: { wall: number; floor?: "back" | "front" | "none" };
  /** Holes through the part (through the floor when hollow). */
  cutouts?: Cutout[];
  /** Screen parts: what the panel shows. */
  display?: ScreenContent;
  /** Emissive glow colour for LEDs. */
  glow?: string;
  /** Stand parts loaded from a printable STL (see stand.ts). */
  stl?: string;
  /**
   * Row-major 4x4 matrix that moves the STL (its own Z-up frame, in mm) into
   * the board frame, so the printed stand sits where the board rests in it.
   */
  stlMatrix?: number[];
}

export interface BoardModel {
  deviceId: string;
  name: string;
  /** Outer size in mm: w along x, h along y, t along z. */
  outer: { w: number; h: number; t: number; shape: "box" | "round" | "board" };
  /** "flat" boards lie on a desk with +z up; "upright" ones face the viewer. */
  orientation: "upright" | "flat";
  /** Outer corner radius in mm, when known. */
  cornerRadius?: number;
  parts: ModelPart[];
  /** URLs the outer dimensions and part facts come from. */
  sources: string[];
}

export interface DimensionSource {
  value: number;
  url: string;
  /** True when the number is an estimate rather than a published figure. */
  approx?: boolean;
  note?: string;
}

export interface BoardDimensionSources {
  w: DimensionSource;
  h: DimensionSource;
  t: DimensionSource;
}

/** One assembly step from the build plan, mapped to model parts. */
export interface ModelStep {
  id: string;
  order: number;
  action: string;
  label: string;
  instruction: string;
  optional: boolean;
  partIds: string[];
}
