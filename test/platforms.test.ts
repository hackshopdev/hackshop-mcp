import { describe, expect, it } from "vitest";
import { loadCatalog } from "../src/catalog/load.js";
import type { DeviceEntry } from "../src/catalog/schema.js";
import { assertPlatformInvariants, loadPlatforms } from "../src/platforms/load.js";
import { PlatformBoard, type Platform } from "../src/platforms/schema.js";

const device = (id: string, tags: string[]): DeviceEntry => ({
  id,
  name: id,
  category: "other",
  idea_fit_tags: tags,
  hack_difficulty: 1,
  brick_risk: 1,
  brick_provenance: "founder-verified",
  last_verified: "2026-10-02",
  firmware_links: [],
  community_size_bucket: "small",
  notes: "test",
});

const platform = (overrides: Partial<Platform> = {}): Platform => ({
  id: "muse-test",
  name: "Muse Test",
  vendor: "Meta",
  kind: "agent-gadget",
  launched: "2026-10-02",
  homepage: "https://example.com",
  sdk_repo: "https://example.com/repo",
  sdk_path: "esp32",
  docs_url: "https://example.com/docs",
  license: "Apache-2.0",
  summary: "test",
  toolchain: "test",
  requires: ["token"],
  setup_steps: ["flash"],
  agent_quickstart: "test",
  tiers: [{ id: "status", label: "Status", description: "test" }],
  caveats: ["test"],
  terms: {
    url: "https://example.com/terms",
    summary: "personal only",
    personal_noncommercial_only: true,
    max_devices_per_token: 50,
    selling_allowed: false,
    revocable: true,
  },
  community_url: "https://example.com/community",
  boards: [{
    device_id: "official-board",
    support: "official",
    tier: "status",
    kind: "light",
    build: "idf.py build",
    features: { home_tunnel: true },
    note: "test",
  }],
  sources: ["https://example.com/source"],
  last_verified: "2026-10-02",
  ...overrides,
});

describe("platforms loader", () => {
  it("loads the bundled platforms file", () => {
    const { devices } = loadCatalog();
    const platforms = loadPlatforms(devices);
    expect(platforms.map((entry) => entry.id)).toEqual(["muse-esp32", "muse-linux"]);
  });

  it("rejects duplicate platform ids", () => {
    const devices = [device("official-board", ["agent-gadget"])];
    expect(() => assertPlatformInvariants([platform(), platform()], devices)).toThrow(
      /duplicate platform id/,
    );
  });

  it("rejects duplicate platform/device pairs", () => {
    const devices = [device("official-board", ["agent-gadget"])];
    expect(() =>
      assertPlatformInvariants([
        platform({
          boards: [
            {
              device_id: "official-board",
              support: "official",
              tier: "status",
              kind: "light",
              build: "idf.py build",
              features: {},
              note: "one",
            },
            {
              device_id: "official-board",
              support: "official",
              tier: "status",
              kind: "light",
              build: "idf.py build",
              features: {},
              note: "two",
            },
          ],
        }),
      ], devices),
    ).toThrow(/duplicate board pair/);
  });

  it("rejects unknown device ids", () => {
    const devices = [device("official-board", ["agent-gadget"])];
    expect(() =>
      assertPlatformInvariants([
        platform({
          boards: [{
            device_id: "missing-board",
            support: "official",
            tier: "status",
            kind: "light",
            build: "idf.py build",
            features: {},
            note: "missing",
          }],
        }),
      ], devices),
    ).toThrow(/unknown device/);
  });

  it("rejects board tiers not declared by the platform", () => {
    const devices = [device("official-board", ["agent-gadget"])];
    expect(() =>
      assertPlatformInvariants([
        platform({
          boards: [{
            device_id: "official-board",
            support: "official",
            tier: "full-ui",
            kind: "light",
            build: "idf.py build",
            features: {},
            note: "bad tier",
          }],
        }),
      ], devices),
    ).toThrow(/unknown tier/);
  });

  it("rejects official platform boards missing the agent-gadget tag", () => {
    const devices = [device("official-board", ["display"])];
    expect(() => assertPlatformInvariants([platform()], devices)).toThrow(/missing tag/);
  });

  it("rejects agent-gadget tags without official platform support", () => {
    const devices = [device("official-board", ["agent-gadget"])];
    expect(() =>
      assertPlatformInvariants([
        platform({
          boards: [{
            device_id: "official-board",
            support: "possible",
            tier: "status",
            kind: "light",
            build: "idf.py build",
            features: {},
            note: "possible only",
          }],
        }),
      ], devices),
    ).toThrow(/not an official platform board/);
  });

  it("accepts numeric board feature values", () => {
    expect(() =>
      PlatformBoard.parse({
        device_id: "official-board",
        support: "official",
        tier: "status",
        kind: "light",
        build: "idf.py build",
        features: { display_in: 3.95 },
        note: "screen size",
      }),
    ).not.toThrow();
  });
});
