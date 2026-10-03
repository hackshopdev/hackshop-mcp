#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { loadCatalog } from "./catalog/load.js";
import type { DeviceEntry } from "./catalog/schema.js";
import { loadPlatforms } from "./platforms/load.js";
import { setLoadedPlatforms } from "./platforms/index.js";
import type { Platform } from "./platforms/schema.js";
import { probeSamplingSupport } from "./sampling.js";
import {
  proposeHardware,
  proposeHardwareInput,
} from "./tools/propose_hardware.js";
import {
  assessHackability,
  assessHackabilityInput,
} from "./tools/assess_hackability.js";
import {
  simulateAssembly,
  simulateAssemblyInput,
} from "./tools/simulate_assembly.js";
import {
  NEED_VALUES,
  planGadget,
  planGadgetInput,
} from "./tools/plan_gadget.js";
import {
  getBuildPlan,
  getBuildPlanInput,
} from "./tools/get_build_plan.js";
import { siteUrlFromEnv } from "./site-url.js";
import { createTelemetry, errorKind } from "./telemetry.js";

const NAME = "hackshop-mcp";
const VERSION = "0.0.5";

export function createToolRunner(context: {
  devices: DeviceEntry[];
  platforms: Platform[];
  server?: Server;
}): (name: string, args: unknown) => Promise<{ out: unknown; degraded?: boolean }> {
  return async (name: string, args: unknown) => {
    if (name === "propose_hardware") {
      if (!context.server) {
        throw new Error("propose_hardware requires an MCP server context");
      }
      const input = proposeHardwareInput.parse(args);
      const out = await proposeHardware(input, context.devices, context.server);
      return { out, degraded: out.degraded };
    }

    if (name === "assess_hackability") {
      const input = assessHackabilityInput.parse(args);
      return { out: assessHackability(input, context.devices) };
    }

    if (name === "plan_gadget") {
      const input = planGadgetInput.parse(args);
      return { out: planGadget(input, context.devices) };
    }

    if (name === "get_build_plan") {
      const input = getBuildPlanInput.parse(args);
      return {
        out: getBuildPlan(input, context.devices, context.platforms, siteUrlFromEnv()),
      };
    }

    if (name === "simulate_assembly") {
      const input = simulateAssemblyInput.parse(args);
      return { out: await simulateAssembly(input) };
    }

    throw new Error(`Unknown tool: ${name}`);
  };
}

async function main(): Promise<void> {
  // Boot validation. Refuses to start on bad catalog/tags.
  const { devices, tags } = loadCatalog();
  const platforms = loadPlatforms(devices);
  setLoadedPlatforms(platforms);
  process.stderr.write(
    `[hackshop-mcp] Catalog loaded: ${devices.length} devices, ${tags.size} tags, ${platforms.length} platforms.\n`,
  );

  // Note: sampling is a CLIENT capability, not a server one. We don't declare
  // it here; we just call server.createMessage(...) and the host either
  // supports it or doesn't. probeSamplingSupport() handles the check.
  const server = new Server(
    { name: NAME, version: VERSION },
    { capabilities: { tools: {} } },
  );

  const telemetry = createTelemetry(VERSION);
  const clientInfo = () => {
    const client = server.getClientVersion();
    return { client_name: client?.name, client_version: client?.version };
  };
  server.oninitialized = () => {
    telemetry.send({
      event: "mcp_server_started",
      ...clientInfo(),
      client_sampling: Boolean(server.getClientCapabilities()?.sampling),
    });
  };

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "propose_hardware",
        description:
          "Given a project idea (vague is fine), return 3-5 hardware proposals with 'why this fits', hack difficulty, brick risk (with safety rule applied), firmware links, community size, and a suggested eBay search query string. Compose with ebay-mcp at the host level for live listings.",
        inputSchema: {
          type: "object",
          properties: {
            idea: {
              type: "string",
              description:
                "Project idea, free-form. Vague is OK; the agent will use creativity.",
            },
            budget_usd: {
              type: "number",
              description: "Optional budget in USD. Affects eBay query suggestions.",
            },
            constraints: {
              type: "string",
              description:
                "Optional constraints (e.g., 'must be wall-mountable', 'low power').",
            },
          },
          required: ["idea"],
        },
      },
      {
        name: "assess_hackability",
        description:
          "Given a device name, return: hackable y/n, hack difficulty, brick risk (with safety rule applied), firmware links, community size, last verified date, and notes. Looks up by id, exact name, or substring.",
        inputSchema: {
          type: "object",
          properties: {
            device_name: {
              type: "string",
              description: "Device name or id.",
            },
          },
          required: ["device_name"],
        },
      },
      {
        name: "plan_gadget",
        description:
          "Plan a physical gadget for an AI agent (Meta Muse Gadgets today). Given an idea, returns the best supported boards with tier, what works on each (voice, images, touch, camera, sensors, home-network tunnel), build commands, setup steps, Muse SDK terms, and printable stand/enclosure files when available. Deterministic: no LLM or network calls.",
        inputSchema: {
          type: "object",
          properties: {
            idea: {
              type: "string",
              description: "Gadget idea or use case.",
            },
            platform: {
              type: "string",
              enum: ["muse-esp32", "muse-linux", "any"],
              description: "Optional platform filter. Defaults to any.",
            },
            budget_usd: {
              type: "number",
              description: "Optional hardware budget in USD.",
            },
            owned_device_ids: {
              type: "array",
              items: { type: "string" },
              description: "Catalog device ids the user already owns.",
            },
            needs: {
              type: "array",
              items: {
                type: "string",
                enum: NEED_VALUES,
              },
              description: "Optional explicit needs; otherwise inferred from idea.",
            },
            limit: {
              type: "number",
              description: "Number of picks to return, 1-5. Defaults to 3.",
            },
          },
          required: ["idea"],
        },
      },
      {
        name: "get_build_plan",
        description:
          "Get a step-by-step build plan for a device: parts list with buy links, numbered steps with exact commands, what to say to it once it works, and an agent-ready Markdown brief you can follow directly. Deterministic, no network.",
        inputSchema: {
          type: "object",
          properties: {
            device_id: {
              type: "string",
              description: "Catalog device id.",
            },
          },
          required: ["device_id"],
        },
      },
      {
        name: "simulate_assembly",
        description:
          "Drop a proposed robot Assembly into a MuJoCo physics world and run a bounded navigation rollout. Returns whether it reached the goal plus honest failure telemetry (stuck/tipped/collisions/heading-oscillation), a natural-language post-mortem, and artifact URLs (rendered mp4, scene.xml, control.py, telemetry.json). Today simulates the diff-drive 'navigate' slice; other goal kinds return an honest 'unsupported'. Requires a running sim-worker (SIM_WORKER_URL).",
        inputSchema: {
          type: "object",
          properties: {
            assembly: {
              type: "object",
              description:
                "Assembly IR: { idea, components[{ref,device_id,name,role}], edges[], goal{kind,spec,success_metric}, world{template,goal_xy?} }. Build it with the site /api/assembly output or by hand.",
            },
            duration_s: {
              type: "number",
              description: "Optional sim seconds (<=10, bounded). Default 8.",
            },
          },
          required: ["assembly"],
        },
      },
    ],
  }));

  const runTool = createToolRunner({ devices, platforms, server });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const startedAt = Date.now();
    try {
      const { out, degraded } = await runTool(name, args);
      telemetry.send({
        event: "mcp_tool_called",
        tool: name,
        success: true,
        degraded,
        duration_ms: Date.now() - startedAt,
        ...clientInfo(),
      });
      return {
        content: [{ type: "text", text: JSON.stringify(out, null, 2) }],
      };
    } catch (err) {
      telemetry.send({
        event: "mcp_tool_called",
        tool: name,
        success: false,
        error_kind: errorKind(err),
        duration_ms: Date.now() - startedAt,
        ...clientInfo(),
      });
      throw err;
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Probe sampling support after connect — but ONLY when explicitly opted in
  // via HACKSHOP_PROBE_SAMPLING=1. Previously this fired a real createMessage on
  // every boot just to log "Sampling probe OK", spending tokens on every start.
  // propose_hardware already degrades gracefully when sampling is unsupported,
  // so the probe is purely informational. Logs to stderr; never fatal.
  if (process.env.HACKSHOP_PROBE_SAMPLING === "1") {
    void probeSamplingSupport(server).then((ok) => {
      if (!ok) {
        process.stderr.write(
          "[hackshop-mcp] Warning: this MCP host does not appear to support " +
            "sampling/createMessage. The propose_hardware tool will return " +
            "degraded responses (raw catalog matches without reasoning). " +
            "Hosts known to support sampling: Claude Desktop, Claude Code.\n",
        );
      } else {
        process.stderr.write("[hackshop-mcp] Sampling probe OK.\n");
      }
    });
  }

  process.stderr.write(`[hackshop-mcp] ${NAME} v${VERSION} ready.\n`);
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  if (import.meta.url === pathToFileURL(entry).href) return true;
  try {
    return import.meta.url === pathToFileURL(realpathSync(entry)).href;
  } catch {
    return false;
  }
}

if (isDirectRun()) {
  main().catch((err) => {
    process.stderr.write(`[hackshop-mcp] Fatal: ${(err as Error).message}\n`);
    process.exit(1);
  });
}
