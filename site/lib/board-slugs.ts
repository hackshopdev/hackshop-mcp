// Short, human URLs for Muse board pages: /muse/<slug>. Pure data so both
// server pages and client components can use it.

export const BOARD_SLUGS: Record<string, string> = {
  "espressif-esp32-c5-devkitc-1": "esp32-c5-devkitc",
  "ideaspark-esp32-1-9-lcd": "ideaspark-1-9-lcd",
  "seeed-sensecap-indicator": "sensecap-indicator",
  "seeed-reterminal-e1001": "reterminal-e1001",
  "home-assistant-voice-pe": "home-assistant-voice-pe",
  "waveshare-esp32-s3-touch-amoled-1-75c": "waveshare-amoled-1-75c",
  "aipi-lite": "aipi-lite",
  "waveshare-esp32-c6-touch-amoled-1-8": "waveshare-c6-amoled-1-8",
  "seeed-sensecap-watcher": "sensecap-watcher",
  "m5stack-sticks3": "sticks3",
  "m5stack-stickc-plus2": "stickc-plus2",
  "raspberry-pi-5": "raspberry-pi-5",
  "raspberry-pi-4b": "raspberry-pi-4b",
  "raspberry-pi-zero-2w": "raspberry-pi-zero-2w",
};

const DEVICE_BY_SLUG = new Map(
  Object.entries(BOARD_SLUGS).map(([deviceId, slug]) => [slug, deviceId]),
);

export function boardSlug(deviceId: string): string | null {
  return BOARD_SLUGS[deviceId] ?? null;
}

export function boardPath(deviceId: string): string | null {
  const slug = boardSlug(deviceId);
  return slug ? `/muse/${slug}` : null;
}

export function deviceIdForSlug(slug: string): string | null {
  return DEVICE_BY_SLUG.get(slug) ?? null;
}

export function allBoardSlugs(): string[] {
  return [...DEVICE_BY_SLUG.keys()];
}
