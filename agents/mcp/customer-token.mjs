// Signs in as a test customer. Prints the access token on stdout (for CUSTOMER_JWT)
// and the customer's own order IDs on stderr (for ORDER_OWN).
// Env: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, CUSTOMER_EMAIL, CUSTOMER_PASSWORD
import { createClient } from "@supabase/supabase-js";

const {
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  CUSTOMER_EMAIL,
  CUSTOMER_PASSWORD,
} = process.env;
if (!CUSTOMER_EMAIL || !CUSTOMER_PASSWORD) {
  console.error(
    "Set CUSTOMER_EMAIL and CUSTOMER_PASSWORD (a test customer, not a staff or agent account).",
  );
  process.exit(1);
}
const c = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data, error } = await c.auth.signInWithPassword({
  email: CUSTOMER_EMAIL,
  password: CUSTOMER_PASSWORD,
});
if (error) {
  console.error("Sign-in failed:", error.message);
  process.exit(1);
}
const orders = await c
  .from("orders")
  .select("id,status,created_at")
  .order("created_at");
console.error("Your orders (row-level security shows only this customer's):");
for (const o of orders.data ?? [])
  console.error(`  ${o.id}  ${o.status}  ${o.created_at}`);
console.log(data.session.access_token);
