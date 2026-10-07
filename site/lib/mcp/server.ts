import { Server } from "@modelcontextprotocol/sdk/server/index.js";
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
import packageJson from "../../../package.json";
import {
  coreToolDefinitions,
  executeCoreTool,
} from "../core/tools";
import {
  RESOURCE_NOT_FOUND_CODE,
  getCorePrompt,
  listCoreResourceTemplates,
  listCorePrompts,
  listCoreResources,
  readCoreResource,
  resourceNotFoundMessage,
} from "../core/resources";
import { anonymousRequestId, captureServerEvent } from "../serverAnalytics";
import type { CoreContext } from "../core/types";

const HOSTED_INSTRUCTIONS =
  "hackshop maps a project idea to hardware and build steps. For firmware reuse, call find_firmware_playbooks, then check_firmware_compatibility with exact observed identifiers; destructive actions are human-run only. For a Muse agent body, ask the human the intake questions from intake_gadget, then call plan_gadget with their answers; it is deterministic, instant and key-free. Use get_build_plan for the flash warnings, shopping list, machine-readable assembly and the agent brief. hackshop never buys anything: show the exact items, sellers and total, ask \"Place this order for $<total> at <seller>?\" and wait for a clear yes. Hosted MCP exposes deterministic tools only and is stateless (POST only); propose_hardware and simulate_assembly are in the npm server (npx -y hackshop-mcp) because they can cost money or need external workers. Hosted MCP logs tool names and timings only.";

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
        ...(result.try_instead
          ? { structuredContent: { error: result.text, try_instead: result.try_instead } }
          : {}),
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
    if (!resource) {
      throw new McpError(
        RESOURCE_NOT_FOUND_CODE,
        resourceNotFoundMessage(resourceRequest.params.uri, ctx),
      );
    }
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
