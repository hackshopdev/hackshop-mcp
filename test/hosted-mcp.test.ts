import { describe, expect, it } from "vitest";
import { POST } from "../site/app/mcp/route";

const HEADERS = {
  "content-type": "application/json",
  accept: "application/json, text/event-stream",
};

async function rpc(method: string, params?: unknown) {
  const response = await POST(new Request("https://www.hackshop.dev/mcp", {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  }));
  expect(response.status).toBeLessThan(500);
  return response.json();
}

describe("hosted MCP route", () => {
  it("handles initialize, deterministic tools and resources", async () => {
    const init = await rpc("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "vitest", version: "0" },
    });
    expect(init.result.serverInfo.name).toBe("hackshop");
    expect(init.result.instructions).toMatch(/Hosted MCP/);

    const tools = await rpc("tools/list");
    expect(tools.result.tools.map((tool: { name: string }) => tool.name)).toEqual([
      "plan_gadget",
      "get_build_plan",
      "assess_hackability",
    ]);
    expect(tools.result.tools.every((tool: { outputSchema?: { type?: string } }) =>
      tool.outputSchema?.type === "object"
    )).toBe(true);

    const plan = await rpc("tools/call", {
      name: "plan_gadget",
      arguments: { idea: "an air quality monitor I can talk to" },
    });
    const planText = plan.result.content[0].text;
    const planJson = JSON.parse(planText);
    expect(plan.result.structuredContent).toEqual(planJson);
    expect(planJson.picks.length).toBeGreaterThan(0);
    expect(planJson.picks.map((pick: { device_id: string }) => pick.device_id))
      .toContain("seeed-sensecap-indicator");

    const badBuild = await rpc("tools/call", {
      name: "get_build_plan",
      arguments: { device_id: "nope" },
    });
    expect(badBuild.result.isError).toBe(true);
    expect(badBuild.result.content[0].text).toMatch(/Unknown device_id "nope"/);

    const boards = await rpc("resources/read", {
      uri: "hackshop://muse/boards",
    });
    const boardsJson = JSON.parse(boards.result.contents[0].text);
    expect(boardsJson.some((board: { device_id: string }) => board.device_id === "m5stack-sticks3"))
      .toBe(true);

    const templates = await rpc("resources/templates/list");
    expect(templates.result.resourceTemplates).toContainEqual(
      expect.objectContaining({
        uriTemplate: "hackshop://build/{device_id}",
        mimeType: "application/json",
      }),
    );

    const build = await rpc("resources/read", {
      uri: "hackshop://build/m5stack-sticks3",
    });
    const buildJson = JSON.parse(build.result.contents[0].text);
    expect(buildJson.device_id).toBe("m5stack-sticks3");
    expect(buildJson.shopping_list.items[0].buy_options.length).toBeGreaterThan(0);
  });
});
