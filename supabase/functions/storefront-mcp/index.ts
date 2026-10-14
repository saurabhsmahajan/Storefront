// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "./server.ts";
import type { Ctx, Db } from "./tools.ts";
import { errorBody } from "./errors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, mcp-session-id, mcp-protocol-version, accept",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const env = (n: string) => Deno.env.get(n) ?? "";
const URL_ = () => env("SUPABASE_URL");
const KEY = () => env("SUPABASE_ANON_KEY") || env("STOREFRONT_PUBLISHABLE_KEY");

const plain = { auth: { persistSession: false, autoRefreshToken: false } };

// Each payment tool signs in as its own specialist, so the token carries that
// specialist's principal_type and RLS limits it to the tables it needs.
const PRINCIPALS = {
  get_payment_status: {
    email: "decline-agent@storefront.test",
    passwordVar: "DECLINE_AGENT_PASSWORD",
  },
  check_refund_eligibility: {
    email: "refund-agent@storefront.test",
    passwordVar: "REFUND_AGENT_PASSWORD",
  },
} as const;

const sessions = new Map<
  string,
  { client: SupabaseClient; expiresAt: number }
>();

async function principalClient(tool: keyof typeof PRINCIPALS) {
  const cached = sessions.get(tool);
  if (cached && cached.expiresAt - Date.now() > 60_000) return cached.client;
  const p = PRINCIPALS[tool];
  const client = createClient(URL_(), KEY(), plain);
  const { data, error } = await client.auth.signInWithPassword({
    email: p.email,
    password: env(p.passwordVar),
  });
  if (error || !data.session) throw new Error("principal sign-in failed");
  sessions.set(tool, {
    client,
    expiresAt: (data.session.expires_at ?? 0) * 1000,
  });
  return client;
}

function makeCtx(authHeader: string | null): Ctx {
  const token = authHeader?.match(/^Bearer (.+)$/i)?.[1] ?? null;
  const customer = token
    ? createClient(URL_(), KEY(), {
        ...plain,
        global: { headers: { Authorization: `Bearer ${token}` } },
      })
    : null;
  const db: Db = {
    async getOwnOrder(userId, orderId) {
      // RLS (orders_select_own) already limits this client; user_id is checked again
      // here so a staff or agent token cannot read someone else's order through us.
      const { data, error } = await customer!
        .from("orders")
        .select("id,status,currency,total_minor,created_at")
        .eq("id", orderId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw new Error("orders read failed");
      return data;
    },
    async getPaymentEvents(orderId, as) {
      const c = await principalClient(as);
      const { data, error } = await c
        .from("payment_events")
        .select("event_type,payload")
        .eq("order_id", orderId)
        .order("received_at");
      if (error) throw new Error("payment_events read failed");
      return data ?? [];
    },
  };
  return {
    db,
    now: () => Date.now(),
    async userId() {
      if (!customer || !token) return null;
      const { data, error } = await customer.auth.getUser(token);
      return error || !data.user ? null : data.user.id;
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify(errorBody("invalid_input")), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const server = createMcpServer(makeCtx(req.headers.get("Authorization")));
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  const res = await transport.handleRequest(req);
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(corsHeaders)) headers.set(k, v);
  return new Response(res.body, { status: res.status, headers });
});
