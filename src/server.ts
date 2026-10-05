#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { loadCatalog } from "./catalog/load.js";
import type { DeviceEntry } from "./catalog/schema.js";
import { loadPlatforms } from "./platforms/load.js";
import { printablesFor, setLoadedPlatforms } from "./platforms/index.js";
import type { Platform } from "./platforms/schema.js";
import { probeSamplingSupport } from "./sampling.js";
import {
  proposeHardware,
  proposeHardwareInput,
} from "./tools/propose_hardware.js";
import {
  simulateAssembly,
  simulateAssemblyInput,
} from "./tools/simulate_assembly.js";
import { siteUrlFromEnv } from "./site-url.js";
import { createTelemetry, errorKind } from "./telemetry.js";
import {
  CORE_TOOLS,
  coreToolDefinitions,
  executeCoreTool,
  type CoreToolResult,
} from "./core/tools.js";
import { formatInputError } from "./core/errors.js";
import {
  RESOURCE_NOT_FOUND_CODE,
  getCorePrompt,
  listCoreResourceTemplates,
  listCorePrompts,
  listCoreResources,
  readCoreResource,
  resourceNotFoundMessage,
} from "./core/resources.js";
import type { CoreContext } from "./core/types.js";

const NAME = "hackshop-mcp";
const VERSION = "0.0.6";
const STDIO_INSTRUCTIONS =
  "hackshop maps a natural-language project idea to hackable, repurposable, or protocol-native hardware. For Muse agent-body gadgets, ask the intake questions from intake_gadget, then call plan_gadget with the answers; it is deterministic, instant and key-free. get_build_plan returns the parts, flash warnings and assembly checks. Use propose_hardware for broader repurposing ideas and existing hardware, especially when the host can sample or ANTHROPIC_API_KEY is set. hackshop never buys anything: show the exact items, sellers and total, ask \"Place this order for $<total> at <seller>?\" and wait for a clear yes. Anonymous usage telemetry (tool names and timings only) is on by default; set HACKSHOP_TELEMETRY=0 to turn it off.";

const CORE_TOOL_NAMES = new Set<string>(CORE_TOOLS.map((tool) => tool.name));

export function createToolRunner(context: {
  devices: DeviceEntry[];
  platforms: Platform[];
  server?: Server;
  tags?: string[];
}): (name: string, args: unknown) => Promise<{
  out: unknown;
  degraded?: boolean;
  isError?: boolean;
  text?: string;
}> {
  return async (name: string, args: unknown) => {
    if (name === "propose_hardware") {
      const parsed = proposeHardwareInput.safeParse(args);
      if (!parsed.success) return inputError(formatInputError(name, parsed.error));
      if (!context.server) {
        throw new Error("propose_hardware requires an MCP server context");
      }
      const out = await proposeHardware(parsed.data, context.devices, context.server);
      return { out, degraded: out.degraded };
    }

    if (CORE_TOOL_NAMES.has(name)) {
      const result = executeCoreTool(
        name,
        args,
        coreContext(context.devices, context.platforms, context.tags),
      );
      return runnerResult(result);
    }

    if (name === "simulate_assembly") {
      const parsed = simulateAssemblyInput.safeParse(args);
      if (!parsed.success) return inputError(formatInputError(name, parsed.error));
      return { out: await simulateAssembly(parsed.data) };
    }

    throw new Error(`Unknown tool: ${name}`);
  };
}

function coreContext(
  catalog: DeviceEntry[],
  platforms: Platform[],
  tags?: string[],
): CoreContext {
  const siteUrl = siteUrlFromEnv();
  return {
    catalog,
    platforms,
    printablesFor: (device, baseUrl) => printablesFor(device as DeviceEntry, baseUrl),
    siteUrl,
    tags,
  };
}

function inputError(text: string): { out: unknown; isError: true; text: string } {
  return { out: { error: text }, isError: true, text };
}

function runnerResult(result: CoreToolResult): {
  out: unknown;
  isError?: boolean;
  text?: string;
} {
  if (result.isError) {
    return { out: { error: result.text }, isError: true, text: result.text };
  }
  return { out: result.output };
}

async function main(): Promise<void> {
  // Boot validation. Refuses to start on bad catalog/tags.
  const { devices, tags } = loadCatalog();
  const sortedTags = [...tags].sort();
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
    {
      capabilities: { tools: {}, resources: {}, prompts: {} },
      instructions: STDIO_INSTRUCTIONS,
    },
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
          "Given a project idea (vague is fine), return 3-5 hardware proposals with 'why this fits', hack difficulty, brick risk (with safety rule applied), firmware links, community size, and a search query for used parts (search eBay yourself).",
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
              exclusiveMinimum: 0,
              description: "Optional budget in USD, greater than 0. Affects the used-parts search suggestions.",
            },
            constraints: {
              type: "string",
              description:
                "Optional constraints (e.g., 'must be wall-mountable', 'low power').",
            },
          },
          required: ["idea"],
        },
        outputSchema: { type: "object", properties: {} },
      },
      ...coreToolDefinitions(),
      {
        name: "simulate_assembly",
        description:
          "Drop a proposed robot Assembly into a MuJoCo physics world and run a bounded navigation rollout. Returns whether it reached the goal plus honest failure telemetry (stuck/tipped/collisions/heading-oscillation), a natural-language post-mortem, and artifact URLs (rendered mp4, scene.xml, control.py, telemetry.json). Today simulates the diff-drive 'navigate' slice; other goal kinds return an honest 'unsupported'. Requires a configured simulation service.",
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
        outputSchema: { type: "object", properties: {} },
      },
    ],
  }));

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: listCoreResources(),
  }));

  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
    resourceTemplates: listCoreResourceTemplates(),
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const ctx = coreContext(devices, platforms, sortedTags);
    const resource = readCoreResource(request.params.uri, ctx);
    if (!resource) {
      throw new McpError(RESOURCE_NOT_FOUND_CODE, resourceNotFoundMessage(request.params.uri, ctx));
    }
    return { contents: [resource] };
  });

  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: listCorePrompts(),
  }));

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const prompt = getCorePrompt(request.params.name, request.params.arguments);
    if (!prompt) {
      throw new Error(`Unknown prompt: ${request.params.name}`);
    }
    return prompt;
  });

  const runTool = createToolRunner({ devices, platforms, server, tags: sortedTags });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const startedAt = Date.now();
    try {
      const { out, degraded, isError, text } = await runTool(name, args);
      telemetry.send({
        event: "mcp_tool_called",
        tool: name,
        success: !isError,
        degraded,
        ...(isError ? { error_kind: "tool_error" } : {}),
        duration_ms: Date.now() - startedAt,
        ...clientInfo(),
      });
      return {
        ...(isError ? { isError: true } : {}),
        content: [{ type: "text", text: text ?? JSON.stringify(out, null, 2) }],
        ...(isError ? {} : { structuredContent: out as Record<string, unknown> }),
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
