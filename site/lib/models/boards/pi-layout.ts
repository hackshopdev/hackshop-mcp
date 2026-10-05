import { COLORS } from "../palette";
import type { ModelPart, Vec3 } from "../types";

// Shared helpers for the Raspberry Pi models. Positions on the official
// mechanical drawings are measured from the board's bottom-left corner;
// piPos turns them into the centred model frame.

export function piPos(x: number, y: number, z: number, board = { w: 85, h: 56 }): Vec3 {
  return [round(x - board.w / 2), round(y - board.h / 2), round(z)];
}

/** A Pi PCB with its four 2.7 mm mounting holes (58 x 49 mm on 85 x 56 boards). */
export function piPcb(args: {
  z: number;
  lesson: string;
  board?: { w: number; h: number; thickness: number };
  holes?: Array<[number, number]>;
}): ModelPart {
  const board = args.board ?? { w: 85, h: 56, thickness: 1.6 };
  const holes = args.holes ?? [
    [3.5, 3.5],
    [61.5, 3.5],
    [3.5, 52.5],
    [61.5, 52.5],
  ];
  return {
    id: "pcb",
    name: "Circuit board",
    kind: "pcb",
    shape: "roundedBox",
    radius: 3,
    size: [board.w, board.h, board.thickness],
    position: [0, 0, round(args.z)],
    cutouts: holes.map(([x, y]) => ({
      shape: "circle" as const,
      size: [2.7, 2.7] as [number, number],
      offset: [round(x - board.w / 2), round(y - board.h / 2)] as [number, number],
    })),
    color: COLORS.pcbGreen,
    finish: "pcb",
    explode: [0, 0, 0],
    lesson: args.lesson,
  };
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
