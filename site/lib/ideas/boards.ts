import "server-only";
import { boardPath } from "../board-slugs";
import { loadCatalog } from "../catalog";
import { hasImage } from "../image-sources";

export interface IdeaBoard {
  deviceId: string;
  name: string;
  /** /muse/<slug> when the board has a page there. */
  href: string | null;
  hasPhoto: boolean;
}

/** Display info for an idea's suggested board, or null if it is unknown. */
export function ideaBoard(deviceId: string | null | undefined): IdeaBoard | null {
  if (!deviceId) return null;
  const device = loadCatalog().devices.find((candidate) => candidate.id === deviceId);
  if (!device) return null;
  return {
    deviceId,
    name: device.name,
    href: boardPath(deviceId),
    hasPhoto: hasImage(deviceId),
  };
}

export function isCatalogDevice(deviceId: string): boolean {
  return loadCatalog().devices.some((candidate) => candidate.id === deviceId);
}
