import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadCatalog } from "../src/catalog/load.js";
import { Platforms } from "../src/platforms/schema.js";
import { createToolRunner } from "../src/server.js";
import { DELETE, GET, OPTIONS, POST } from "../site/app/mcp/route";

const { devices } = loadCatalog();
const platforms = Platforms.parse(
  JSON.parse(readFileSync(join(process.cwd(), "platforms.json"), "utf8")),
);

const ORIGIN = "https://claude.ai";
const HEADERS = {
  "content-type": "application/json",
  accept: "application/json, text/event-stream",
  origin: ORIGIN,
};

async function rpc(method: string, params?: unknown) {
  const response = await POST(new Request("https://www.hackshop.dev/mcp", {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  }));
  return { response, body: await response.json() };
}

function expectCors(response: Response) {
  expect(response.headers.get("access-control-allow-origin")).toBe("*");
  expect(response.headers.get("access-control-allow-methods")).toBe("POST, GET, DELETE, OPTIONS");
  expect(response.headers.get("access-control-allow-headers")).toBe(
    "content-type, accept, mcp-session-id, mcp-protocol-version, authorization",
  );
  expect(response.headers.get("access-control-expose-headers")).toBe("mcp-session-id");
}

describe("HS-MCP-001: CORS on /mcp", () => {
  it("answers the preflight", async () => {
    const response = await OPTIONS();
    expect(response.status).toBe(204);
    expectCors(response);
  });

  it("adds CORS headers to POST responses", async () => {
    const { response, body } = await rpc("tools/list");
    expect(response.status).toBe(200);
    expectCors(response);
    expect(body.result.tools.length).toBeGreaterThan(0);
  });
});

describe("HS-MCP-002: stateless, POST only", () => {
  it("GET and DELETE return 405 with an Allow header that matches", async () => {
    for (const response of [
      await GET(new Request("https://www.hackshop.dev/mcp", { headers: { accept: "text/event-stream" } })),
      await DELETE(),
    ]) {
      expect(response.status).toBe(405);
      expect(response.headers.get("allow")).toBe("POST, OPTIONS");
      expectCors(response);
      expect((await response.json()).error.message).toMatch(/stateless/);
    }
  });

  it("never issues a session id", async () => {
    const { response } = await rpc("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "vitest", version: "0" },
    });
    expect(response.headers.get("mcp-session-id")).toBeNull();
  });
});

describe("HS-MCP-003: build resource template", () => {
  it("lists the template and points to it from resources/list", async () => {
    const templates = (await rpc("resources/templates/list")).body;
    expect(templates.result.resourceTemplates).toContainEqual(
      expect.objectContaining({ uriTemplate: "hackshop://build/{device_id}" }),
    );
    const resources = (await rpc("resources/list")).body;
    expect(resources.result.resources.some((resource: { description: string }) =>
      resource.description.includes("hackshop://build/{device_id}")
    )).toBe(true);
  });

  it("explains how to read the literal template URI", async () => {
    const { body } = await rpc("resources/read", { uri: "hackshop://build/{device_id}" });
    expect(body.error.code).toBe(-32002);
    expect(body.error.message).toMatch(/is a URI template/);
    expect(body.error.message).toContain("hackshop://build/seeed-sensecap-watcher");
  });

  it("names an example for an unknown device", async () => {
    const { body } = await rpc("resources/read", { uri: "hackshop://build/nope" });
    expect(body.error.message).toMatch(/Unknown device_id "nope"/);
    expect(body.error.message).toContain("hackshop://build/seeed-sensecap-watcher");
  });

  it("mcp.json advertises only what works", () => {
    const manifest = JSON.parse(
      readFileSync(join(process.cwd(), "site", "public", ".well-known", "mcp.json"), "utf8"),
    ) as { resources: string[]; resource_templates: string[]; tools: Array<{ name: string }>; stateless: boolean };
    expect(manifest.resources.every((uri) => !uri.includes("{"))).toBe(true);
    expect(manifest.resource_templates).toEqual(["hackshop://build/{device_id}"]);
    expect(manifest.tools.map((tool) => tool.name)).toEqual([
      "intake_gadget",
      "plan_gadget",
      "get_build_plan",
      "assess_hackability",
    ]);
    expect(manifest.stateless).toBe(true);
  });
});

describe("HS-MCP-005 / HS-MCP-006: input errors", () => {
  const runTool = createToolRunner({ devices, platforms });

  it("budget_usd: 0 says greater than 0", async () => {
    const result = await runTool("plan_gadget", { idea: "desk muse", budget_usd: 0 });
    expect(result.isError).toBe(true);
    expect(result.text).toBe("`budget_usd` must be greater than 0.");
  });

  it("simulate_assembly errors are plain sentences, not Zod JSON", async () => {
    const result = await runTool("simulate_assembly", {
      assembly: {
        idea: "x",
        components: [{ ref: "a", device_id: "b", name: "c", role: "compute" }],
        goal: { kind: "wave", spec: { not: "a string" }, success_metric: "m" },
        world: { template: "empty-room" },
      },
    });
    expect(result.isError).toBe(true);
    expect(result.text).toMatch(/`assembly\.goal\.kind` must be one of: navigate/);
    expect(result.text).toMatch(/`assembly\.goal\.spec` must be string/);
    expect(result.text).not.toContain("[{");
  });

  it("propose_hardware errors go through the same formatter", async () => {
    const result = await runTool("propose_hardware", { idea: "x", budget_usd: -5 });
    expect(result.isError).toBe(true);
    expect(result.text).toMatch(/`idea` must be at least 3 characters/);
    expect(result.text).toMatch(/`budget_usd` must be greater than 0/);
  });

  it("hosted MCP points npm-only tools to npx with try_instead", async () => {
    for (const name of ["propose_hardware", "simulate_assembly"]) {
      const { body } = await rpc("tools/call", { name, arguments: { idea: "a desk lamp" } });
      expect(body.result.isError).toBe(true);
      expect(body.result.content[0].text).toContain("npx -y hackshop-mcp");
      expect(body.result.structuredContent.try_instead).toBe("available in the npm server: npx -y hackshop-mcp");
    }
  });
});
