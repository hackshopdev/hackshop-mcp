import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

// Anonymous usage telemetry for the MCP server. It exists so the maintainer
// can see that the server is being used at all: stdio servers run on users'
// machines and are otherwise invisible.
//
// Sent: event name, tool name, success/degraded, duration, hackshop-mcp
// version, MCP client name/version, OS platform, Node major version, and a
// random install id. NEVER sent: tool arguments, ideas, device names, results,
// API keys, file paths, or anything typed by the user.
//
// Opt out with HACKSHOP_TELEMETRY=0 (or DO_NOT_TRACK=1).

export const DEFAULT_TELEMETRY_URL = "https://www.hackshop.dev/api/telemetry/mcp";
const SEND_TIMEOUT_MS = 1_500;

export type TelemetryEvent =
  | {
      event: "mcp_server_started";
      client_name?: string;
      client_version?: string;
      client_sampling?: boolean;
    }
  | {
      event: "mcp_tool_called";
      tool: string;
      success: boolean;
      duration_ms: number;
      degraded?: boolean;
      error_kind?: string;
      client_name?: string;
      client_version?: string;
    };

const KNOWN_TOOLS = new Set(["propose_hardware", "assess_hackability", "simulate_assembly"]);

export function telemetryEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const flag = env.HACKSHOP_TELEMETRY?.trim().toLowerCase();
  if (flag && ["0", "false", "off", "no", "disabled"].includes(flag)) return false;
  const dnt = env.DO_NOT_TRACK?.trim().toLowerCase();
  if (dnt && dnt !== "0" && dnt !== "false") return false;
  // Test runners and CI are not real usage.
  if (env.VITEST || env.CI) return false;
  return true;
}

function configPath(env: NodeJS.ProcessEnv): string {
  const base = env.XDG_CONFIG_HOME?.trim() || join(homedir(), ".config");
  return join(base, "hackshop-mcp", "telemetry.json");
}

/**
 * Stable random install id, so repeat use by one person counts once. Falls
 * back to a per-process id if the config dir is not writable.
 */
export function loadInstallId(
  env: NodeJS.ProcessEnv = process.env,
  onCreate: (path: string) => void = () => {},
): string {
  const path = configPath(env);
  try {
    const stored = JSON.parse(readFileSync(path, "utf8")) as { install_id?: unknown };
    if (typeof stored.install_id === "string" && stored.install_id.length === 36) {
      return stored.install_id;
    }
  } catch {
    // Missing or unreadable: create below.
  }
  const id = randomUUID();
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify({ install_id: id }) + "\n", "utf8");
    onCreate(path);
  } catch {
    // Read-only home, sandbox, etc. A per-process id is fine.
  }
  return id;
}

export type Telemetry = {
  enabled: boolean;
  send(event: TelemetryEvent): void;
};

export function createTelemetry(
  version: string,
  env: NodeJS.ProcessEnv = process.env,
  log: (line: string) => void = (line) => process.stderr.write(line),
): Telemetry {
  if (!telemetryEnabled(env)) {
    return { enabled: false, send: () => {} };
  }
  const installId = loadInstallId(env, () =>
    log(
      "[hackshop-mcp] Anonymous usage telemetry is on (tool names and timings only; " +
        "never your ideas or tool inputs). Opt out with HACKSHOP_TELEMETRY=0.\n",
    ),
  );
  const url = env.HACKSHOP_TELEMETRY_URL?.trim() || DEFAULT_TELEMETRY_URL;
  const base = {
    install_id: installId,
    mcp_version: version,
    platform: process.platform,
    node_version: process.versions.node.split(".")[0],
  };

  return {
    enabled: true,
    send(event) {
      const payload =
        event.event === "mcp_tool_called" && !KNOWN_TOOLS.has(event.tool)
          ? { ...event, tool: "unknown" }
          : event;
      // Fire and forget: never awaited, never throws, never blocks a tool call.
      void fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...base, ...payload }),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      }).catch(() => {});
    },
  };
}

/** Coarse error bucket; the message itself is not sent. */
export function errorKind(err: unknown): string {
  if (err && typeof err === "object" && "name" in err) {
    const name = String((err as { name: unknown }).name);
    if (name === "ZodError") return "invalid_input";
    if (name === "AbortError" || name === "TimeoutError") return "timeout";
  }
  return "error";
}
