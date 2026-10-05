import type { BoardModel } from "../types";
import { aipiLite } from "./aipi-lite";
import { esp32C5DevKitC1 } from "./espressif-esp32-c5-devkitc-1";
import { homeAssistantVoicePe } from "./home-assistant-voice-pe";
import { ideasparkEsp32Lcd } from "./ideaspark-esp32-1-9-lcd";
import { m5StickCPlus2 } from "./m5stack-stickc-plus2";
import { m5StickS3 } from "./m5stack-sticks3";
import { raspberryPi4b } from "./raspberry-pi-4b";
import { raspberryPi5 } from "./raspberry-pi-5";
import { raspberryPiZero2w } from "./raspberry-pi-zero-2w";
import { reTerminalE1001 } from "./seeed-reterminal-e1001";
import { reTerminalE1002 } from "./seeed-reterminal-e1002";
import { senseCapIndicator } from "./seeed-sensecap-indicator";
import { senseCapWatcher } from "./seeed-sensecap-watcher";
import { waveshareS3Amoled175c } from "./waveshare-esp32-s3-touch-amoled-1-75c";
import { waveshareC6Amoled18 } from "./waveshare-esp32-c6-touch-amoled-1-8";

/** Every board hackshop lists for Muse, in the order of the /muse page. */
export const BOARD_MODELS: readonly BoardModel[] = [
  esp32C5DevKitC1,
  ideasparkEsp32Lcd,
  senseCapIndicator,
  reTerminalE1001,
  reTerminalE1002,
  homeAssistantVoicePe,
  waveshareS3Amoled175c,
  aipiLite,
  waveshareC6Amoled18,
  senseCapWatcher,
  m5StickS3,
  m5StickCPlus2,
  raspberryPi5,
  raspberryPi4b,
  raspberryPiZero2w,
];

const BY_ID = new Map(BOARD_MODELS.map((model) => [model.deviceId, model]));

export const MODEL_DEVICE_IDS: readonly string[] = BOARD_MODELS.map((model) => model.deviceId);

export function getBoardModel(deviceId: string): BoardModel | null {
  return BY_ID.get(deviceId) ?? null;
}
