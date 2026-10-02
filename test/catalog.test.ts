import { describe, it, expect } from "vitest";
import { Catalog, DeviceEntry, Physical } from "../src/catalog/schema.js";
import { loadCatalog, parseTags } from "../src/catalog/load.js";

const validEntry = {
  id: "test-id",
  name: "Test",
  category: "display",
  idea_fit_tags: ["display"],
  hack_difficulty: 1,
  brick_risk: 1,
  brick_provenance: "founder-verified",
  last_verified: "2026-05-04",
  firmware_links: [],
  community_size_bucket: "small",
  notes: "x",
};

describe("catalog schema", () => {
  it("accepts a valid entry", () => {
    expect(DeviceEntry.parse(validEntry)).toBeTruthy();
  });

  it("rejects bad id (uppercase)", () => {
    expect(() => DeviceEntry.parse({ ...validEntry, id: "BadId" })).toThrow();
  });

  it("rejects out-of-range hack_difficulty", () => {
    expect(() => DeviceEntry.parse({ ...validEntry, hack_difficulty: 6 })).toThrow();
  });

  it("rejects bad date format", () => {
    expect(() => DeviceEntry.parse({ ...validEntry, last_verified: "May 4, 2026" })).toThrow();
  });

  it("rejects notes over 500 chars", () => {
    const long = "x".repeat(501);
    expect(() => DeviceEntry.parse({ ...validEntry, notes: long })).toThrow();
  });

  it("requires at least one tag", () => {
    expect(() => DeviceEntry.parse({ ...validEntry, idea_fit_tags: [] })).toThrow();
  });

  it("rejects more than 8 tags", () => {
    const tags = Array(9).fill("display");
    expect(() => DeviceEntry.parse({ ...validEntry, idea_fit_tags: tags })).toThrow();
  });

  it("accepts all real catalog entries, including physical blocks", () => {
    const { devices } = loadCatalog();
    expect(Catalog.parse(devices)).toHaveLength(devices.length);
    expect(devices.some((device) => device.physical)).toBe(true);
  });

  it("rejects printable parts when thickness is unknown", () => {
    expect(() =>
      Physical.parse({
        orientation: "upright",
        shape: "board",
        size_mm: { w: 10, h: 20, t: null },
        size_confidence: "published",
        comes_in_case: false,
        mass_g: null,
        usb: null,
        mounting: null,
        printables: ["desk-stand"],
        source_url: "https://example.com/device",
      }),
    ).toThrow();
  });

  it("rejects bad USB face enums", () => {
    expect(() =>
      Physical.parse({
        orientation: "upright",
        shape: "board",
        size_mm: { w: 10, h: 20, t: 5 },
        size_confidence: "drawing",
        comes_in_case: false,
        mass_g: null,
        usb: {
          type: "usb-c",
          count: 1,
          faces: ["diagonal"],
        },
        mounting: null,
        printables: [],
        source_url: "https://example.com/device",
      }),
    ).toThrow();
  });
});

describe("tag parser", () => {
  it("extracts backtick-wrapped tags from markdown bullets", () => {
    const md = "- `display` — has a screen\n- `e-ink` — low-power\n";
    const tags = parseTags(md);
    expect(tags.has("display")).toBe(true);
    expect(tags.has("e-ink")).toBe(true);
    expect(tags.size).toBe(2);
  });

  it("ignores lines without backtick tags", () => {
    const md = "## Header\nplain text\n- not a tag\n";
    const tags = parseTags(md);
    expect(tags.size).toBe(0);
  });
});

describe("loadCatalog (integration)", () => {
  it("loads the bundled catalog without errors", () => {
    const { devices, tags } = loadCatalog();
    expect(devices.length).toBeGreaterThan(0);
    expect(tags.size).toBeGreaterThan(0);
  });

  it("every catalog tag is in tags.md", () => {
    const { devices, tags } = loadCatalog();
    for (const d of devices) {
      for (const t of d.idea_fit_tags) {
        expect(tags.has(t)).toBe(true);
      }
    }
  });
});
