import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import packageJson from "../package.json";
import { PURCHASE_CONFIRM_PHRASE, PURCHASE_POLICY } from "../src/build-plan/index.js";
import { CORE_TOOLS } from "../src/core/tools.js";
import { GET as storeJson } from "../site/app/store.json/route";

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), "utf8");
const REPO = "https://github.com/hackshopdev/hackshop-mcp";

/** eBay mentions outside the shared purchase policy text. */
function extraEbayMentions(text: string): number {
  const withoutPolicy = text.split(PURCHASE_POLICY).join("").split(JSON.stringify(PURCHASE_POLICY).slice(1, -1)).join("");
  return (withoutPolicy.match(/ebay/gi) ?? []).length;
}

describe("HS-SEC-001 / item 19: one purchase policy", () => {
  it("has the new text with the confirm phrase", () => {
    expect(PURCHASE_POLICY).toBe(
      "hackshop never buys anything. Your agent can help you buy the parts: it shows you the exact items, sellers and total, then asks \"Place this order for $<total> at <seller>?\" and waits for a clear yes before it checks out. If it can't check out on a site, or the site doesn't allow automated checkout (Amazon and eBay don't), it gives you the link to buy yourself.",
    );
    expect(PURCHASE_POLICY).toContain(PURCHASE_CONFIRM_PHRASE);
  });

  it("is quoted word for word in agents.md, llms.txt and ai-agent.json", () => {
    expect(read("site", "public", "agents.md")).toContain(PURCHASE_POLICY);
    expect(read("site", "public", "llms.txt")).toContain(PURCHASE_POLICY);
    const aiAgent = JSON.parse(read("site", "public", ".well-known", "ai-agent.json"));
    expect(aiAgent.guardrails.purchase_policy).toBe(PURCHASE_POLICY);
  });

  it("is in store.json, which has no eBay listings unless eBay is configured", async () => {
    delete process.env.EBAY_CLIENT_ID;
    delete process.env.EBAY_CLIENT_SECRET;
    const body = await (await storeJson()).json();
    expect(body.purchase_policy).toContain(PURCHASE_POLICY);
    expect(body.ebay_live).toBe(false);
    expect(body.price_checked).toBe("2026-10-05");
    for (const board of body.boards) {
      expect(board.ebay).not.toHaveProperty("listings");
      expect(board.difficulty === null || ["green", "blue", "black"].includes(board.difficulty.level)).toBe(true);
    }
    expect(extraEbayMentions(JSON.stringify({ ...body, boards: [], common_parts: [] }))).toBeLessThanOrEqual(1);
  });

  it("matches in README, the MCP instructions and the prompt", () => {
    expect(read("README.md")).toContain(PURCHASE_CONFIRM_PHRASE);
    expect(read("src", "server.ts")).toContain(PURCHASE_CONFIRM_PHRASE);
    expect(read("site", "lib", "mcp", "server.ts")).toContain(PURCHASE_CONFIRM_PHRASE);
    expect(read("src", "core", "resources.ts")).toContain(PURCHASE_CONFIRM_PHRASE);
  });
});

describe("item 19: less eBay", () => {
  it("mentions eBay at most once per doc outside the policy, with no live-listing claims", () => {
    const docs: Record<string, string> = {
      "agents.md": read("site", "public", "agents.md"),
      "llms.txt": read("site", "public", "llms.txt"),
      "README.md": read("README.md"),
      "tool descriptions": JSON.stringify(CORE_TOOLS.map((tool) => tool.description)) + read("src", "server.ts"),
    };
    for (const file of readdirSync(join(root, "site", "public", ".well-known"))) {
      docs[file] = read("site", "public", ".well-known", file);
    }
    for (const [name, text] of Object.entries(docs)) {
      expect(extraEbayMentions(text), name).toBeLessThanOrEqual(1);
      expect(text, name).not.toMatch(/newest eBay listings|live eBay|ebay-mcp/i);
    }
  });
});

describe("HS-DOC-001 / HS-DOC-002: version and repo URL", () => {
  it("README status matches package.json with a changelog", () => {
    const readme = read("README.md");
    expect(readme).toContain(`## Status\n\nv${packageJson.version} `);
    expect(readme).toContain("### Changelog");
    expect(readme).toContain(`- **${packageJson.version}**`);
  });

  it("uses one canonical repo URL everywhere", () => {
    expect(packageJson.homepage).toBe(REPO);
    expect(packageJson.repository.url).toBe(`git+${REPO}.git`);
    expect(packageJson.bugs.url).toBe(`${REPO}/issues`);
    expect(JSON.parse(read("site", "public", ".well-known", "mcp.json")).docs).toBe(REPO);
    expect(JSON.parse(read("site", "public", ".well-known", "agent-card.json")).links.documentation).toBe(REPO);
    expect(read("README.md")).toContain(REPO);
    expect(read("site", "public", "llms.txt")).toContain(REPO);
    for (const text of [read("README.md"), read("AGENTS.md"), read("site", "public", "llms.txt"), read("site", "public", "agents.md")]) {
      expect(text).not.toMatch(/github\.com\/(?!hackshopdev\/|facebookincubator\/|espressif\/)[\w-]+\/hackshop/);
    }
  });
});

describe("HS-DOC-003: OpenAPI", () => {
  const spec = JSON.parse(read("site", "public", "openapi.json"));

  it("documents GET and POST /api/plan with answers", () => {
    expect(spec.openapi).toMatch(/^3\./);
    expect(spec.paths["/api/plan"].get).toBeDefined();
    expect(spec.paths["/api/plan"].post).toBeDefined();
    expect(spec.components.schemas.PlanRequest.properties.answers.$ref).toBe("#/components/schemas/IntakeAnswers");
    expect(Object.keys(spec.components.schemas.IntakeAnswers.properties)).toEqual(["size", "interaction", "sensing", "budget"]);
    const getParams = spec.paths["/api/plan"].get.parameters.map((param: { name: string }) => param.name);
    expect(getParams).toEqual(expect.arrayContaining(["idea", "size", "interaction", "sensing", "budget"]));
  });

  it("is linked from llms.txt and mcp.json, and ai-plugin.json is gone", () => {
    expect(read("site", "public", "llms.txt")).toContain("https://www.hackshop.dev/openapi.json");
    expect(JSON.parse(read("site", "public", ".well-known", "mcp.json")).openapi).toBe("https://www.hackshop.dev/openapi.json");
    expect(existsSync(join(root, "site", "public", ".well-known", "ai-plugin.json"))).toBe(false);
    for (const text of [read("site", "public", "llms.txt"), read("site", "public", "agents.md"), read("README.md"), read("AGENTS.md")]) {
      expect(text).not.toContain("ai-plugin");
    }
  });
});

describe("HS-DOC-004: robots", () => {
  it("lists private APIs explicitly and never blanket-disallows /api/", async () => {
    const { default: robots } = await import("../site/app/robots");
    const rules = robots().rules;
    const rule = Array.isArray(rules) ? rules[0]! : rules;
    const allow = [rule.allow ?? []].flat();
    const disallow = [rule.disallow ?? []].flat();
    expect(disallow).not.toContain("/api/");
    expect(disallow).toEqual(expect.arrayContaining([
      "/api/projects",
      "/api/email",
      "/api/contact",
      "/api/propose",
      "/api/simulate",
      "/api/telemetry",
    ]));
    expect(allow).toEqual(expect.arrayContaining(["/api/plan", "/api/img"]));
    for (const path of ["/api/plan", "/api/img"]) {
      expect(disallow.some((prefix) => path.startsWith(prefix))).toBe(false);
    }
  });
});

describe("items 20-21: replies are text, no personal names", () => {
  it("drops spoken-reply claims from the planner core and data", () => {
    for (const file of ["src/core/plan-gadget.ts", "platforms.json", "catalog.json"]) {
      expect(read(file), file).not.toMatch(/with spoken replies|replies can't be spoken/i);
    }
    expect(read("src/core/plan-gadget.ts")).toContain("add a text-to-speech service for spoken replies");
  });

  it("keeps personal names out of LICENSE and docs", () => {
    expect(read("LICENSE")).toContain("Copyright (c) 2026 the hackshop authors");
    const docs = readdirSync(join(root, "docs"))
      .filter((file) => file.endsWith(".md"))
      .map((file) => read("docs", file));
    for (const text of [read("LICENSE"), read("README.md"), read("AGENTS.md"), ...docs]) {
      expect(text).not.toMatch(/msanchezgrice|\/Users\/(?!YOU\b)[a-z]+\//);
    }
  });
});
