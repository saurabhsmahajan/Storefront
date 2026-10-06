import { createClient } from "@supabase/supabase-js";

const SPECIALISTS = {
  order_status: {
    email: "order-status-agent@storefront.test",
    passwordVar: "ORDER_STATUS_AGENT_PASSWORD",
  },
  refund: {
    email: "refund-agent@storefront.test",
    passwordVar: "REFUND_AGENT_PASSWORD",
  },
  decline: {
    email: "decline-agent@storefront.test",
    passwordVar: "DECLINE_AGENT_PASSWORD",
  },
};

const clients = {};

// Real sign-in per specialist, so the token carries that specialist's claim.
export async function clientFor(role) {
  if (clients[role]) return clients[role];
  const spec = SPECIALISTS[role];
  if (!spec) throw new Error(`Unknown specialist: ${role}`);
  const password = process.env[spec.passwordVar];
  if (!password) throw new Error(`Missing ${spec.passwordVar} in .env`);
  const client = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error } = await client.auth.signInWithPassword({
    email: spec.email,
    password,
  });
  if (error) throw new Error(`Sign-in failed for ${role}: ${error.message}`);
  clients[role] = client;
  return client;
}

export async function getOrder(orderId, role) {
  const client = await clientFor(role);
  const { data, error } = await client
    .from("orders")
    .select("id,status,currency,total_minor,created_at")
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getPayments(orderId, role) {
  const client = await clientFor(role);
  const { data, error } = await client
    .from("payment_events")
    .select("event_type,received_at,payload")
    .eq("order_id", orderId)
    .order("received_at");
  if (error) throw new Error(error.message);
  return data;
}
