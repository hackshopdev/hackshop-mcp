import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import packageJson from "../../../package.json";
import {
  coreToolDefinitions,
  executeCoreTool,
} from "../core/tools";
import {
  getCorePrompt,
  listCoreResourceTemplates,
  listCorePrompts,
  listCoreResources,
  readCoreResource,
} from "../core/resources";
import { anonymousRequestId, captureServerEvent } from "../serverAnalytics";
import type { CoreContext } from "../core/types";

const HOSTED_INSTRUCTIONS =
  "Hackshop maps a project idea to hardware and build steps. Use plan_gadget for Muse agent-body gadgets because it is deterministic, instant and key-free. Use get_build_plan for shopping lists, machine-readable assembly and the agent brief, then ask the human before buying anything. Hosted MCP exposes deterministic tools only; propose_hardware and simulate_assembly are npm-only because they can cost money or require external workers. Hackshop never buys anything. Hosted MCP logs tool names and timings only.";

export function createHostedMcpServer(ctx: CoreContext, request: Request): Server {
  const server = new Server(
    { name: "hackshop", version: packageJson.version },
    {
      capabilities: { tools: {}, resources: {}, prompts: {} },
      instructions: HOSTED_INSTRUCTIONS,
    },
  );
  const distinctId = anonymousRequestId(request);

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: coreToolDefinitions(),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (toolRequest) => {
    const startedAt = Date.now();
    const result = executeCoreTool(
      toolRequest.params.name,
      toolRequest.params.arguments,
      ctx,
    );
    const ok = !result.isError;
    await captureServerEvent({
      event: "mcp_tool_called",
      distinctId,
      properties: {
        tool: toolRequest.params.name,
        duration_ms: Date.now() - startedAt,
        ok,
        error: !ok,
        transport: "http",
      },
    });

    if (result.isError) {
      return {
        isError: true,
        content: [{ type: "text" as const, text: result.text }],
      };
    }

    return {
      content: [{ type: "text" as const, text: JSON.stringify(result.output, null, 2) }],
      structuredContent: result.output as Record<string, unknown>,
    };
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: listCoreResources(),
  }));

  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
    resourceTemplates: listCoreResourceTemplates(),
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (resourceRequest) => {
    const resource = readCoreResource(resourceRequest.params.uri, ctx);
    if (!resource) throw new Error(`Unknown resource: ${resourceRequest.params.uri}`);
    return { contents: [resource] };
  });

  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: listCorePrompts(),
  }));

  server.setRequestHandler(GetPromptRequestSchema, async (promptRequest) => {
    const prompt = getCorePrompt(
      promptRequest.params.name,
      promptRequest.params.arguments,
    );
    if (!prompt) throw new Error(`Unknown prompt: ${promptRequest.params.name}`);
    return prompt;
  });

  return server;
}
