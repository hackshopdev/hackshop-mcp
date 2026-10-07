import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadCatalog } from "../src/catalog/load.js";
import { FirmwarePlaybookCatalog } from "../src/core/firmware.js";
import {
  checkFirmwareCompatibility,
  findFirmwarePlaybooks,
  getFirmwarePlaybook,
  prepareFirmwareJob,
  verifyFirmwareArtifact,
} from "../src/core/firmware-tools.js";

function fixture() {
  const playbooks = FirmwarePlaybookCatalog.parse(
    JSON.parse(readFileSync(join(process.cwd(), "firmware-playbooks.json"), "utf8")),
  );
  return { catalog: loadCatalog().devices, firmwarePlaybooks: playbooks };
}

describe("firmware playbook catalog", () => {
  it("ships a curated first release connected to catalog devices", () => {
    const ctx = fixture();
    const ids = new Set(ctx.catalog.map((device) => device.id));

    expect(ctx.firmwarePlaybooks).toHaveLength(15);
    expect(ctx.firmwarePlaybooks.every((playbook) => ids.has(playbook.device_id))).toBe(true);
    expect(ctx.firmwarePlaybooks.filter((playbook) => playbook.family === "amazon-echo"))
      .toHaveLength(5);
  });

  it("requires evidence, recovery, independent risk axes and a checked date", () => {
    const ctx = fixture();
    for (const playbook of ctx.firmwarePlaybooks) {
      expect(playbook.sources.length).toBeGreaterThan(0);
      expect(playbook.recovery.level).toBeTruthy();
      expect(playbook.risks.brick).toBeTruthy();
      expect(playbook.risks.electrical).toBeTruthy();
      expect(playbook.risks.physical_safety).toBeTruthy();
      expect(playbook.risks.privacy_security).toBeTruthy();
      expect(playbook.risks.warranty_legal).toBeTruthy();
      expect(playbook.last_verified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("documents the compatibility-first agent flow without a generic flash tool", () => {
    const docs = ["README.md", "site/public/agents.md", "site/public/llms.txt"]
      .map((path) => readFileSync(join(process.cwd(), path), "utf8"));
    for (const text of docs) {
      expect(text).toContain("find_firmware_playbooks");
      expect(text).toContain("check_firmware_compatibility");
      expect(text).not.toContain("`flash_device`");
    }
  });
});

describe("firmware playbook tools", () => {
  it("finds least-invasive and replacement paths without conflating them", () => {
    const ctx = fixture();
    const hue = findFirmwarePlaybooks({ query: "Hue local lights" }, ctx);
    const echo = findFirmwarePlaybooks({ query: "reuse my Alexa Echo" }, ctx);

    expect(hue.matches[0]?.intervention).toBe("protocol_replacement");
    expect(echo.matches.some((match) => match.family === "amazon-echo")).toBe(true);
    expect(echo.matches.every((match) => match.family !== "robot-vacuum")).toBe(true);
  });

  it("fails closed when a required identifier is missing", () => {
    const ctx = fixture();
    const out = checkFirmwareCompatibility(
      { playbook_id: "techo5-echo-dot-2", observed: {} },
      ctx,
    );

    expect(out.status).toBe("unknown");
    expect(out.missing).toContain("model_number");
    expect(out.safe_to_prepare).toBe(false);
  });

  it("returns unsupported on an explicit hardware mismatch", () => {
    const ctx = fixture();
    const out = checkFirmwareCompatibility(
      {
        playbook_id: "techo5-echo-dot-2",
        observed: { model_number: "B7W64E", codename: "kara" },
      },
      ctx,
    );

    expect(out.status).toBe("unsupported");
    expect(out.safe_to_prepare).toBe(false);
  });

  it("recognizes the exact supported Echo Dot 2 target", () => {
    const ctx = fixture();
    const out = checkFirmwareCompatibility(
      {
        playbook_id: "techo5-echo-dot-2",
        observed: { model_number: "RS03QR", codename: "biscuit" },
      },
      ctx,
    );

    expect(out.status).toBe("community_confirmed");
    expect(out.safe_to_prepare).toBe(true);
  });

  it("returns the complete playbook and a human-run mutation boundary", () => {
    const ctx = fixture();
    const out = getFirmwarePlaybook({ playbook_id: "openwrt-archer-c7-v5" }, ctx);

    expect(out.found).toBe(true);
    expect(out.playbook?.destructive_action).toBe("human_run_only");
    expect(out.playbook?.confirmation_prompt).toContain("Continue?");
    expect(out.playbook?.backup.required).toBe(true);
  });

  it("does not claim an artifact is verified when no matching hash is curated", () => {
    const ctx = fixture();
    const out = verifyFirmwareArtifact(
      {
        playbook_id: "openwrt-archer-c7-v5",
        filename: "factory.bin",
        sha256: "a".repeat(64),
        source_url: "https://downloads.openwrt.org/",
      },
      ctx,
    );

    expect(out.status).toBe("unknown");
    expect(out.safe_to_use).toBe(false);
  });

  it("prepares a manifest but never a flash command", () => {
    const ctx = fixture();
    const out = prepareFirmwareJob(
      {
        playbook_id: "techo5-echo-dot-2",
        owner_authorized: true,
        observed: { model_number: "RS03QR", codename: "biscuit" },
      },
      ctx,
    );

    expect(out.ready_to_prepare).toBe(true);
    expect(out.execution).toBe("human_run_only");
    expect(out).not.toHaveProperty("flash_command");
    expect(out.stop_points).toContain("Stop if any backup verification fails.");
  });
});
