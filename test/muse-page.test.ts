import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getMusePageData } from "../site/lib/muse-page";

interface ManifestPart {
  device_id: string;
  files: Record<string, string>;
}

function manifestPrintableDeviceIds(): string[] {
  const manifestPath = join(process.cwd(), "site", "public", "cad", "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    parts: ManifestPart[];
  };
  const ids = manifest.parts
    .filter((part) =>
      Object.values(part.files).every((file) =>
        existsSync(join(process.cwd(), "site", "public", file.replace(/^\/cad\//, "cad/"))),
      ),
    )
    .map((part) => part.device_id);

  return [...new Set(ids)].sort();
}

describe("Muse page data assembly", () => {
  it("joins Muse ESP32 boards with catalog data and sorts full UI before status", () => {
    const data = getMusePageData();
    const rows = data.esp32.boards;

    expect(rows).toHaveLength(11);

    const firstStatus = rows.findIndex((row) => row.tier === "status");
    expect(firstStatus).toBeGreaterThan(0);
    expect(rows.slice(0, firstStatus).every((row) => row.tier === "full-ui")).toBe(true);
    expect(rows.slice(firstStatus).every((row) => row.tier === "status")).toBe(true);

    const fullUiRows = rows.filter((row) => row.tier === "full-ui");
    expect(fullUiRows.at(-1)?.device.id).toBe("m5stack-stickc-plus2");
  });

  it("attaches printable parts only for devices with manifest files", () => {
    const data = getMusePageData();
    const printableIds = data.esp32.boards
      .filter((row) => row.printables.length > 0)
      .map((row) => row.device.id)
      .sort();

    expect(printableIds).toEqual(manifestPrintableDeviceIds());
  });

  it("provides display-ready labels, terms and FAQ facts", () => {
    const data = getMusePageData();

    for (const row of data.esp32.boards) {
      expect(row.priceLabel).toMatch(/^\$/);
      expect(row.tierLabel).toMatch(/Full UI|Status/);
    }

    expect(data.esp32.platform.terms.summary).toContain("Personal, non-commercial");
    expect(data.faq.map((entry) => entry.answer).join("\n")).toContain("50");
  });

  it("labels voice modes by push-to-talk and audio capability", () => {
    const data = getMusePageData();
    const rows = new Map(data.esp32.boards.map((row) => [row.device.id, row]));

    expect(rows.get("m5stack-sticks3")?.voiceLabel).toBe("Spoken");
    expect(rows.get("m5stack-sticks3")?.whatWorks).toContain("Push-to-talk with spoken replies");
    expect(rows.get("m5stack-stickc-plus2")?.voiceLabel).toBe("Voice in, no speaker");
    expect(rows.get("m5stack-stickc-plus2")?.whatWorks).toContain("Push-to-talk (buzzer, no speaker)");
    expect(rows.get("waveshare-esp32-c6-touch-amoled-1-8")?.voiceLabel).toBe(
      "Text replies",
    );
    expect(rows.get("waveshare-esp32-c6-touch-amoled-1-8")?.whatWorks).toContain(
      "Push-to-talk with text replies",
    );
  });
});
