import { buildPlanForDevice } from "../build-plan-data";
import { getBoardModel } from "./boards";
import { modelSteps } from "./steps";
import type { ModelStep } from "./types";

/** Server-side: a board's build-plan assembly steps mapped to model parts. */
export function modelStepsForDevice(deviceId: string): ModelStep[] {
  const model = getBoardModel(deviceId);
  const plan = buildPlanForDevice(deviceId);
  if (!model || !plan) return [];
  return modelSteps(model, plan.assembly);
}
