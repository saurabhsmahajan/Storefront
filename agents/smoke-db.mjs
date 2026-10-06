import { clientFor } from "./lib/db.mjs";

for (const role of ["order_status", "refund", "decline"]) {
  const client = await clientFor(role);
  const o = await client
    .from("orders")
    .select("*", { count: "exact", head: true });
  const p = await client
    .from("payment_events")
    .select("*", { count: "exact", head: true });
  console.log(
    role,
    "orders:",
    o.error ? o.error.message : o.count,
    "payment_events:",
    p.error ? p.error.message : p.count,
  );
}
