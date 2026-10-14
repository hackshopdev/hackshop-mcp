import { describe, expect, it } from "vitest";
import { loadCatalog } from "../src/catalog/load.js";
import {
  ReverseEngineeringExampleCatalog,
  type ReverseEngineeringExample,
} from "../src/core/reverse-engineering.js";
import {
  findReverseEngineeringExamples,
} from "../src/core/reverse-engineering-tools.js";
import {
  listCoreResourceTemplates,
  listCoreResources,
  readCoreResource,
  resourceNotFoundMessage,
} from "../src/core/resources.js";
import { coreToolDefinitions } from "../src/core/tools.js";
import { loadReverseEngineeringExamples } from "../src/reverse-engineering/load.js";
import { loadCoreContext } from "../site/lib/mcp/context";

describe("reverse-engineering example catalog", () => {
  it("loads the shared file with defaults and valid catalog links", () => {
    const examples = loadReverseEngineeringExamples();
    const siteExamples = loadCoreContext().reverseEngineeringExamples ?? [];
    const catalogIds = new Set(loadCatalog().devices.map((device) => device.id));

    expect(examples.length).toBeGreaterThan(0);
    expect(siteExamples).toEqual(examples);
    expect(examples.every((example) => example.exact_models !== undefined)).toBe(true);
    expect(examples.every((example) => example.catalog_device_ids !== undefined)).toBe(true);
    expect(examples.every((example) => example.warnings !== undefined)).toBe(true);
    for (const example of examples) {
      for (const deviceId of example.catalog_device_ids) {
        expect(catalogIds.has(deviceId), `${example.id} links unknown catalog id ${deviceId}`).toBe(true);
      }
    }
  });

  it("rejects duplicate ids", () => {
    const example = fixtureExample({ id: "same-id" });
    const parsed = ReverseEngineeringExampleCatalog.safeParse([example, example]);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((issue) => issue.message.includes("duplicate"))).toBe(true);
    }
  });

  it("rejects inverted price ranges", () => {
    expect(ReverseEngineeringExampleCatalog.safeParse([fixtureExample({
      price: { min_usd: 40, max_usd: 10, condition: "new", availability: "in_stock",
        scope: "device_only", checked_at: "2026-10-14", source_url: "https://example.com/seller", note: "Device only" },
    })]).success).toBe(false);
  });
});

describe("find_reverse_engineering_examples", () => {
  const examples = ReverseEngineeringExampleCatalog.parse([
    fixtureExample({
      id: "new-display-demo",
      title: "Rooted photo frame dashboard",
      device_name: "Android photo frame",
      exact_models: ["Frame 10"],
      category: "display",
      method: "root",
      evidence: "author_demo",
      reproducibility: "demo_only",
      published_at: "2026-10-14",
      tags: ["dashboard", "photo-frame"],
    }),
    fixtureExample({
      id: "older-keyboard-guide",
      title: "Keyboard firmware guide",
      device_name: "Mechanical keyboard",
      category: "input",
      method: "firmware",
      evidence: "documented",
      reproducibility: "repeatable",
      published_at: "2026-09-01",
      tags: ["keyboard", "zmk"],
    }),
    fixtureExample({
      id: "undated-analysis-tool",
      title: "Firmware analysis toolkit",
      device_name: "Firmware image",
      category: "other",
      method: "analysis_tool",
      evidence: "analysis_method",
      reproducibility: "method_only",
      published_at: undefined,
      tags: ["firmware", "analysis"],
    }),
  ]);

  it("returns newest dated entries first and undated entries last", () => {
    const result = findReverseEngineeringExamples({ query: "", limit: 20 }, {
      reverseEngineeringExamples: examples,
    });
    expect(result.total).toBe(3);
    expect(result.matches.map((match) => match.id)).toEqual([
      "new-display-demo",
      "older-keyboard-guide",
      "undated-analysis-tool",
    ]);
    expect(result.evidence_note).toMatch(/author_demo/);
  });

  it("searches case-insensitively across models and tags and combines filters", () => {
    const model = findReverseEngineeringExamples({ query: "FRAME 10", limit: 20 }, {
      reverseEngineeringExamples: examples,
    });
    const filtered = findReverseEngineeringExamples({
      query: "firmware",
      evidence: "documented",
      method: "firmware",
      category: "input",
      limit: 20,
    }, { reverseEngineeringExamples: examples });

    expect(model.matches.map((match) => match.id)).toEqual(["new-display-demo"]);
    expect(filtered.matches.map((match) => match.id)).toEqual(["older-keyboard-guide"]);
  });

  it("filters design use and known device prices while preserving stock and accessory scope", () => {
    const priced = fixtureExample({
      id: "priced-calendar", category: "display",
      design_ideas: [{ title: "Appointment tile", description: "Native UI supplied by a calendar host", use_case: "calendar" }],
      price: { min_usd: 9.04, max_usd: 14.04, condition: "new", availability: "out_of_stock",
        scope: "device_only", checked_at: "2026-10-14", source_url: "https://example.com/seller", note: "Add power and host" },
    });
    const unknown = fixtureExample({ id: "unknown-price", design_ideas: priced.design_ideas });
    const ctx = { reverseEngineeringExamples: [priced, unknown] };
    const result = findReverseEngineeringExamples({ query: "", limit: 20, use_case: "calendar", max_device_price_usd: 10 }, ctx);
    expect(result.matches.map((example) => example.id)).toEqual(["priced-calendar"]);
    expect(result.matches[0]?.price?.availability).toBe("out_of_stock");
    expect(result.matches[0]?.price?.max_usd).toBe(14.04);
    expect(result.price_note).toMatch(/lowest listed variant/);
    expect(findReverseEngineeringExamples({ query: "", limit: 20, use_case: "ai_interface" }, ctx).total).toBe(0);
    expect(findReverseEngineeringExamples({ query: "appointment tile", limit: 20 }, ctx).total).toBe(2);
  });
});

describe("reverse-engineering MCP surface", () => {
  it("exposes a deterministic tool, index resource and item template", () => {
    expect(coreToolDefinitions()).toContainEqual(
      expect.objectContaining({ name: "find_reverse_engineering_examples" }),
    );
    expect(listCoreResources()).toContainEqual(
      expect.objectContaining({ uri: "hackshop://reverse-engineering/examples" }),
    );
    expect(listCoreResourceTemplates()).toContainEqual(
      expect.objectContaining({ uriTemplate: "hackshop://reverse-engineering/{example_id}" }),
    );
  });

  it("reads the index and a complete individual record", () => {
    const ctx = loadCoreContext();
    const first = ctx.reverseEngineeringExamples?.[0];
    expect(first).toBeDefined();

    const index = readCoreResource("hackshop://reverse-engineering/examples", ctx);
    expect(index).not.toBeNull();
    const parsedIndex = JSON.parse(index?.text ?? "{}") as {
      total: number;
      examples: ReverseEngineeringExample[];
      evidence_note: string;
    };
    expect(parsedIndex.total).toBe(ctx.reverseEngineeringExamples?.length);
    expect(parsedIndex.evidence_note).toMatch(/not blanket compatibility/);

    const item = readCoreResource(
      `hackshop://reverse-engineering/${encodeURIComponent(first?.id ?? "")}`,
      ctx,
    );
    expect(JSON.parse(item?.text ?? "{}")).toEqual(first);
  });

  it("gives actionable errors for template and unknown example URIs", () => {
    const ctx = loadCoreContext();
    expect(resourceNotFoundMessage(
      "hackshop://reverse-engineering/{example_id}",
      ctx,
    )).toContain("hackshop://reverse-engineering/examples");
    expect(resourceNotFoundMessage(
      "hackshop://reverse-engineering/not-real",
      ctx,
    )).toMatch(/Unknown reverse-engineering example/);
  });
});

function fixtureExample(
  overrides: Partial<ReverseEngineeringExample> = {},
): ReverseEngineeringExample {
  return {
    id: "fixture-example",
    title: "Fixture example",
    device_name: "Fixture device",
    exact_models: [],
    category: "other",
    summary: "A concise summary of the reverse-engineering work.",
    outcome: "The owner gained a documented local capability.",
    method: "protocol",
    evidence: "documented",
    reproducibility: "repeatable",
    published_at: "2026-01-01",
    catalog_device_ids: [],
    tags: ["fixture"],
    risk_level: "low",
    warnings: [],
    sources: [{
      label: "Primary repository",
      url: "https://github.com/example/example",
      kind: "repo",
      checked_at: "2026-10-14",
    }],
    last_verified: "2026-10-14",
    ...overrides,
  };
}
