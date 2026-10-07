import type { BoardModel, PartKind } from "@/lib/models/types";

export const MODEL_NOTE = "Simplified model. Outer size to scale; inside parts are approximate.";

export const KIND_LABELS: Record<PartKind, string> = {
  "shell-front": "Case, front",
  "shell-back": "Case, back",
  glass: "Cover glass",
  screen: "Screen",
  pcb: "Circuit board",
  chip: "Chip",
  battery: "Battery",
  speaker: "Sound",
  mic: "Microphone",
  camera: "Camera",
  button: "Button",
  port: "Port",
  led: "Light",
  antenna: "Radio",
  cable: "Cable",
  stand: "Stand",
  sensor: "Sensor",
};

function mm(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

/** "85 x 56 x 19.5 mm", or "55 mm round, 15.05 mm thick". */
export function formatOuter(model: BoardModel): string {
  const { w, h, t, shape } = model.outer;
  if (shape === "round") return `${mm(w)} mm round, ${mm(t)} mm thick`;
  return `${mm(w)} x ${mm(h)} x ${mm(t)} mm`;
}
