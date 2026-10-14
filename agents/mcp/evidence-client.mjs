// Calls the storefront-mcp function as a client and writes a dated evidence file.
// Env: TARGET_SLUG (file name part, e.g. "live"), MCP_URL (function URL), CUSTOMER_JWT (a signed-in customer's access token),
//      ORDER_OWN (an order ID owned by that customer), TARGET_LABEL (e.g. "local, fake backend").
import fs from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const {
  MCP_URL,
  CUSTOMER_JWT,
  ORDER_OWN,
  TARGET_LABEL = "unlabelled",
} = process.env;
if (!MCP_URL || !CUSTOMER_JWT || !ORDER_OWN) {
  console.error("Set MCP_URL, CUSTOMER_JWT and ORDER_OWN.");
  process.exit(1);
}
const OTHER = "00000000-0000-4000-8000-00000000dead";

async function connect(token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const c = new Client({ name: "evidence-client", version: "0" });
  await c.connect(
    new StreamableHTTPClientTransport(new URL(MCP_URL), {
      requestInit: { headers },
    }),
  );
  return c;
}
const out = [];
const log = (...s) => out.push(...s);
const json = (v) => "```json\n" + JSON.stringify(v, null, 2) + "\n```";

const c = await connect(CUSTOMER_JWT);
const tools = (await c.listTools()).tools;
log(
  "## Tool list as the client sees it",
  "",
  json(
    tools.map(({ name, description, inputSchema }) => ({
      name,
      description,
      inputSchema,
    })),
  ),
  "",
);

const calls = [
  ["get_order", { order_id: ORDER_OWN }, "success"],
  ["get_payment_status", { order_id: ORDER_OWN }, "success"],
  ["check_refund_eligibility", { order_id: ORDER_OWN }, "success"],
  ["get_order", { order_id: "101" }, "error: invalid_input"],
  ["get_order", { order_id: OTHER }, "error: not_found"],
];
log("## Calls", "");
for (const [name, args, label] of calls) {
  const r = await c.callTool({ name, arguments: args });
  log(
    `### ${name} (${label})`,
    "",
    "Arguments:",
    json(args),
    `isError: ${r.isError ?? false}`,
    "",
    "Result:",
    json(JSON.parse(r.content[0].text)),
    "",
  );
}
await c.close();

const anon = await connect(null);
const r = await anon.callTool({
  name: "get_order",
  arguments: { order_id: ORDER_OWN },
});
log(
  "### get_order with no token (error: unauthorized)",
  "",
  `isError: ${r.isError ?? false}`,
  "",
  json(JSON.parse(r.content[0].text)),
  "",
);
await anon.close();

const date = new Date().toISOString().slice(0, 10);
const file = `../../evidence/week-3-mcp-server-calls-${TARGET_SLUG}-${date}.md`;
fs.writeFileSync(
  new URL(file, import.meta.url),
  [
    `# Week 3 step D: MCP server calls (${date})`,
    "",
    `Target: ${TARGET_LABEL}. Function URL: ${new URL(MCP_URL).origin}${new URL(MCP_URL).pathname}`,
    "",
    "Not shown here: upstream_unavailable and internal. They cannot be provoked on demand; they are covered by unit tests in agents/mcp/storefront-mcp.test.mjs.",
    "",
    ...out,
  ].join("\n"),
);
console.log("wrote", file);
