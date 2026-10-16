// Reads raw rows as the reviewer. The staff account's token carries principal_type=staff,
// so RLS lets it read payment_events. Credentials stay on the server, never in the page.
import { createClient } from "@supabase/supabase-js";

export async function staffSource(env = process.env) {
  const {
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    REVIEWER_EMAIL,
    REVIEWER_PASSWORD,
  } = env;
  if (
    !SUPABASE_URL ||
    !SUPABASE_PUBLISHABLE_KEY ||
    !REVIEWER_EMAIL ||
    !REVIEWER_PASSWORD
  )
    throw new Error(
      "Set SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, REVIEWER_EMAIL and REVIEWER_PASSWORD.",
    );
  const c = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await c.auth.signInWithPassword({
    email: REVIEWER_EMAIL,
    password: REVIEWER_PASSWORD,
  });
  if (error) throw new Error(`Reviewer sign-in failed: ${error.message}`);
  const principal = data.user?.app_metadata?.principal_type;
  if (principal !== "staff")
    throw new Error(
      `Reviewer must be a staff principal, found "${principal ?? "none"}".`,
    );
  return {
    reviewerEmail: data.user.email,
    async getOrder(id) {
      const { data: row, error: e } = await c
        .from("orders")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (e) throw new Error(e.message);
      return row;
    },
    async getEvents(id) {
      const { data: rows, error: e } = await c
        .from("payment_events")
        .select("*")
        .eq("order_id", id)
        .order("received_at");
      if (e) throw new Error(e.message);
      return rows;
    },
  };
}
