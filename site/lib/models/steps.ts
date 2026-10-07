import type { AssemblyStep } from "../build-plan/types";
import type { BoardModel, ModelPart, ModelStep, PartKind } from "./types";

// Maps build-plan assembly steps (site/lib/build-plan) to the model parts
// each step touches, so the viewer can light them up. Pure functions, safe
// to import from client components.

type Action = AssemblyStep["action"];

export const STEP_LABELS: Record<Action, string> = {
  print: "Print",
  place: "Place",
  insert: "Insert",
  connect: "Connect",
  route_cable: "Route the cable",
  fasten: "Fasten",
  power: "Power",
  backup: "Back up",
  flash: "Flash",
  pair: "Pair",
  verify: "Verify",
};

/** Part kinds each step action involves (before per-board narrowing). */
export const STEP_PART_KINDS: Record<Action, PartKind[]> = {
  print: ["stand"],
  place: ["stand", "shell-back", "pcb"],
  insert: ["port"],
  connect: ["port", "cable"],
  route_cable: ["port", "cable", "stand"],
  fasten: ["shell-front", "shell-back"],
  power: ["port", "cable", "battery"],
  backup: ["chip", "port"],
  flash: ["chip", "port", "button"],
  pair: ["button", "led", "screen", "antenna"],
  verify: ["screen", "led", "speaker", "mic", "camera"],
};

const MAIN_CHIP = /esp32|soc|rp3a0/;
const PAIR_BUTTON_FALLBACK = /boot|top|green|center|wheel/;

function ofKind(parts: ModelPart[], ...kinds: PartKind[]): ModelPart[] {
  return parts.filter((part) => kinds.includes(part.kind));
}

/** USB or barrel ports that carry power (and data, on ESP32 boards). */
function powerPorts(parts: ModelPart[]): ModelPart[] {
  const ports = ofKind(parts, "port");
  const power = ports.filter((part) => part.id.includes("power"));
  if (power.length > 0) return power;
  return ports.filter((part) => part.id.startsWith("usb"));
}

function pairButtons(parts: ModelPart[]): ModelPart[] {
  const buttons = ofKind(parts, "button");
  const talk = buttons.filter((part) => /talk/i.test(part.name));
  if (talk.length > 0) return talk;
  return buttons.filter((part) => PAIR_BUTTON_FALLBACK.test(part.id));
}

function mainChips(parts: ModelPart[]): ModelPart[] {
  return ofKind(parts, "chip").filter((part) => MAIN_CHIP.test(part.id));
}

/** Model parts involved in one assembly step on one board. */
export function partsForStep(model: BoardModel, step: Pick<AssemblyStep, "action" | "part_ids">): string[] {
  const parts = model.parts;
  const stands = ofKind(parts, "stand");
  const printed = stands.filter((part) => part.stl);
  let picked: ModelPart[] = [];

  switch (step.action) {
    case "print":
      picked = printed.length > 0 ? printed : stands;
      break;
    case "place": {
      const holder = ofKind(parts, "shell-back");
      picked = [...printed, ...(holder.length > 0 ? holder : ofKind(parts, "pcb"))];
      break;
    }
    case "insert":
      picked = ofKind(parts, "port").filter((part) => part.id.includes("sd"));
      break;
    case "connect":
      picked = [...ofKind(parts, "port").filter((part) => part.id.startsWith("usb")), ...ofKind(parts, "cable")];
      break;
    case "route_cable":
      picked = [...powerPorts(parts), ...ofKind(parts, "cable"), ...printed];
      break;
    case "fasten":
      picked = ofKind(parts, "shell-front", "shell-back");
      break;
    case "power":
      picked = [...powerPorts(parts), ...ofKind(parts, "cable"), ...ofKind(parts, "battery").filter((part) => !part.optional)];
      break;
    case "backup":
      picked = [...mainChips(parts), ...powerPorts(parts)];
      break;
    case "flash":
      picked = [
        ...mainChips(parts),
        ...powerPorts(parts),
        ...ofKind(parts, "button").filter((part) => part.id.startsWith("boot")),
      ];
      break;
    case "pair":
      picked = [...pairButtons(parts), ...ofKind(parts, "led", "screen"), ...ofKind(parts, "antenna")];
      break;
    case "verify":
      picked = ofKind(parts, "screen", "led", "speaker", "mic", "camera");
      break;
  }

  if (step.part_ids.some((id) => id.startsWith("printed-"))) picked.push(...printed);
  if (step.part_ids.some((id) => /microsd|sd-card/.test(id))) {
    picked.push(...ofKind(parts, "port").filter((part) => part.id.includes("sd")));
  }
  if (picked.length === 0) picked = mainChips(parts);
  if (picked.length === 0) picked = ofKind(parts, "pcb");
  return [...new Set(picked.map((part) => part.id))];
}

/** The board's assembly steps with the parts each one involves. */
export function modelSteps(model: BoardModel, assembly: AssemblyStep[]): ModelStep[] {
  return assembly.map((step) => ({
    id: step.id,
    order: step.order,
    action: step.action,
    label: STEP_LABELS[step.action] ?? step.action,
    instruction: step.instruction,
    optional: step.optional,
    partIds: partsForStep(model, step),
  }));
}
