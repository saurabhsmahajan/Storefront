// One-off setup: creates the conversation-host identity (principal_type = agent_host).
// Needs the Supabase SECRET key for this one run only. It is not used at runtime.
// Env: SUPABASE_URL, SUPABASE_SECRET_KEY, AGENT_HOST_PASSWORD
import { createClient } from "../agents/node_modules/@supabase/supabase-js/dist/index.mjs";

const { SUPABASE_URL, SUPABASE_SECRET_KEY, AGENT_HOST_PASSWORD } = process.env;
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY || !AGENT_HOST_PASSWORD) {
  console.error(
    "Set SUPABASE_URL, SUPABASE_SECRET_KEY and AGENT_HOST_PASSWORD for this run.",
  );
  process.exit(1);
}
const admin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data, error } = await admin.auth.admin.createUser({
  email: "agent-host@storefront.test",
  password: AGENT_HOST_PASSWORD,
  email_confirm: true,
  app_metadata: { principal_type: "agent_host" },
});
if (error) {
  console.error("Create failed:", error.message);
  process.exit(1);
}
console.log("Created", data.user.email, data.user.app_metadata);
