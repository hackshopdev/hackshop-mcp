import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createTelemetry,
  errorKind,
  loadInstallId,
  telemetryEnabled,
} from "../src/telemetry.js";
import {
  anonymousRequestId,
  buildPosthogPayload,
  classifyUserAgent,
  requestCallerKind,
} from "../site/lib/serverAnalytics.js";

describe("MCP telemetry opt-out", () => {
  it("is on by default outside tests and CI", () => {
    expect(telemetryEnabled({})).toBe(true);
  });

  it.each([
    [{ HACKSHOP_TELEMETRY: "0" }],
    [{ HACKSHOP_TELEMETRY: "off" }],
    [{ HACKSHOP_TELEMETRY: "false" }],
    [{ DO_NOT_TRACK: "1" }],
    [{ CI: "true" }],
    [{ VITEST: "true" }],
  ])("is off for %o", (env) => {
    expect(telemetryEnabled(env)).toBe(false);
  });

  it("does not touch the network or disk when disabled", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const t = createTelemetry("0.0.0", { HACKSHOP_TELEMETRY: "0" });
    t.send({ event: "mcp_server_started" });
    expect(t.enabled).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe("MCP telemetry payload", () => {
  afterEach(() => vi.restoreAllMocks());

  it("persists one random install id and announces it once", () => {
    const dir = mkdtempSync(join(tmpdir(), "hackshop-telemetry-"));
    const env = { XDG_CONFIG_HOME: dir };
    const created: string[] = [];
    const first = loadInstallId(env, (p) => created.push(p));
    const second = loadInstallId(env, (p) => created.push(p));
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(second).toBe(first);
    expect(created).toHaveLength(1);
    const stored = JSON.parse(
      readFileSync(join(dir, "hackshop-mcp", "telemetry.json"), "utf8"),
    );
    expect(stored).toEqual({ install_id: first });
  });

  it("sends metadata only and never tool arguments", async () => {
    const dir = mkdtempSync(join(tmpdir(), "hackshop-telemetry-"));
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));
    const t = createTelemetry(
      "9.9.9",
      { XDG_CONFIG_HOME: dir, HACKSHOP_TELEMETRY_URL: "https://example.test/t" },
      () => {},
    );
    t.send({
      event: "mcp_tool_called",
      tool: "propose_hardware",
      success: true,
      duration_ms: 12,
      client_name: "claude-code",
    });
    t.send({ event: "mcp_tool_called", tool: "rm -rf", success: false, duration_ms: 1 });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("https://example.test/t");
    const body = JSON.parse(String(init?.body));
    expect(Object.keys(body).sort()).toEqual(
      [
        "client_name",
        "duration_ms",
        "event",
        "install_id",
        "mcp_version",
        "node_version",
        "platform",
        "success",
        "tool",
      ].sort(),
    );
    expect(body.mcp_version).toBe("9.9.9");
    const unknown = JSON.parse(String(fetchSpy.mock.calls[1]![1]?.body));
    expect(unknown.tool).toBe("unknown");
  });

  it("swallows network failures", async () => {
    const dir = mkdtempSync(join(tmpdir(), "hackshop-telemetry-"));
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    const t = createTelemetry("0.0.0", { XDG_CONFIG_HOME: dir }, () => {});
    expect(() => t.send({ event: "mcp_server_started" })).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
  });

  it("buckets errors without leaking messages", () => {
    expect(errorKind(Object.assign(new Error("idea text"), { name: "ZodError" }))).toBe(
      "invalid_input",
    );
    expect(errorKind(new Error("secret idea"))).toBe("error");
  });
});

describe("site server analytics", () => {
  it("stamps the Portfolio Brain server-capture contract", () => {
    const payload = buildPosthogPayload(
      "phc_test",
      { event: "mcp_tool_called", distinctId: "mcp_x", properties: { tool: "a", skip: undefined } },
      new Date("2026-09-25T00:00:00Z"),
    );
    expect(payload.properties).toMatchObject({
      tool: "a",
      site_id: "hackshop.dev",
      origin: "server",
    });
    expect(payload.properties).not.toHaveProperty("$host");
    expect(payload.properties).not.toHaveProperty("skip");
    expect(payload.timestamp).toBe("2026-09-25T00:00:00.000Z");
  });

  it("derives a day-scoped anonymous id without exposing the IP", () => {
    const req = new Request("https://www.hackshop.dev/llms.txt", {
      headers: { "x-forwarded-for": "203.0.113.9", "user-agent": "ClaudeBot/1.0" },
    });
    const day1 = anonymousRequestId(req, new Date("2026-09-25T10:00:00Z"));
    const sameDay = anonymousRequestId(req, new Date("2026-09-25T23:00:00Z"));
    const day2 = anonymousRequestId(req, new Date("2026-09-26T01:00:00Z"));
    expect(day1).toBe(sameDay);
    expect(day1).not.toBe(day2);
    expect(day1).not.toContain("203.0.113.9");
  });

  it("classifies agent and browser user agents", () => {
    expect(classifyUserAgent("Mozilla/5.0 (compatible; ClaudeBot/1.0)")).toBe("anthropic");
    expect(classifyUserAgent("Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2)")).toBe("openai");
    expect(classifyUserAgent("curl/8.4.0")).toBe("script");
    expect(classifyUserAgent("Mozilla/5.0 (Macintosh) Safari/605.1.15")).toBe("browser");
    expect(classifyUserAgent(null)).toBe("unknown");
  });

  it("tells site fetches from direct API callers", () => {
    const site = new Request("https://www.hackshop.dev/api/propose", {
      headers: { "sec-fetch-site": "same-origin" },
    });
    const direct = new Request("https://www.hackshop.dev/api/propose");
    expect(requestCallerKind(site)).toBe("site");
    expect(requestCallerKind(direct)).toBe("direct");
  });
});
