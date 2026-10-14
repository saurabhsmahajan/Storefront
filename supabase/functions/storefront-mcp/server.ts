import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { callTool, TOOLS } from "./tools.ts";
import type { Ctx } from "./tools.ts";

// One server per request, because each request carries a different customer.
export function createMcpServer(ctx: Ctx) {
  const server = new Server(
    { name: "storefront-support", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));
  server.setRequestHandler(
    CallToolRequestSchema,
    async (req: { params: { name: string; arguments?: unknown } }) => {
      const r = await callTool(ctx, req.params.name, req.params.arguments);
      return {
        isError: r.isError,
        content: [{ type: "text", text: JSON.stringify(r.body) }],
      };
    },
  );
  return server;
}
