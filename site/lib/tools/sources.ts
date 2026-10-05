// Shared bits for the free tools under /tools. Every price on those pages
// comes from the 2026-10-05 fact sheet and carries its source URL.

export const PRICES_CHECKED_ISO = "2026-10-05";
export const PRICES_CHECKED_LABEL = "Prices checked October 5, 2026";

export interface SourceLink {
  label: string;
  url: string;
}

export const SDK_REPO_URL = "https://github.com/facebookincubator/muse-gadget-sdk";
export const SDK_ESP32_README_URL =
  "https://github.com/facebookincubator/muse-gadget-sdk/blob/main/esp32/README.md";
export const SDK_ESP32_AGENTS_URL =
  "https://github.com/facebookincubator/muse-gadget-sdk/blob/main/esp32/AGENTS.md";
export const SDK_DEVICES_README_URL =
  "https://github.com/facebookincubator/muse-gadget-sdk/blob/main/esp32/devices/README.md";
export const SDK_LINUX_README_URL =
  "https://github.com/facebookincubator/muse-gadget-sdk/blob/main/linux/README.md";

export const ESPRESSIF_SERIAL_GUIDE_URL =
  "https://docs.espressif.com/projects/esp-idf/en/stable/esp32/get-started/establish-serial-connection.html";
export const ESPTOOL_TROUBLESHOOTING_URL =
  "https://docs.espressif.com/projects/esptool/en/latest/esp32/troubleshooting.html";
export const ARDUINO_NOT_DETECTED_URL =
  "https://support.arduino.cc/hc/en-us/articles/4412955149586-If-your-board-is-not-detected-by-Arduino-IDE";

/** Format a dollar amount the way the tools show it: $21.50, $219, $1,202.78. */
export function formatUsd(value: number, { cents }: { cents?: boolean } = {}): string {
  const rounded = Math.round(value * 100) / 100;
  const showCents = cents ?? !Number.isInteger(rounded);
  return `$${rounded.toLocaleString("en-US", {
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  })}`;
}
