import { clientFor } from "./lib/db.mjs";

const ORDER_ID = "5eed0000-0000-4000-8000-000000000103";
const EVENT_PSP = "SEEDFAIL107A";
const show = (r) =>
  r.error ? `ERROR: ${r.error.message}` : `${r.data.length} row(s)`;

for (const role of ["order_status", "refund", "decline"]) {
  const c = await clientFor(role);
  const o = await c.from("orders").select("id,status").eq("id", ORDER_ID);
  const p = await c
    .from("payment_events")
    .select("psp_reference,event_type")
    .eq("psp_reference", EVENT_PSP);
  // Same value the order already has, so a failed control corrupts nothing.
  const w = await c
    .from("orders")
    .update({ status: "paid" })
    .eq("id", ORDER_ID)
    .select("id");
  console.log(
    `${role.padEnd(13)} read order 103: ${show(o)} | read event ${EVENT_PSP}: ${show(p)} | write order 103: ${show(w)}`,
  );
}

const check = await (
  await clientFor("refund")
)
  .from("orders")
  .select("status")
  .eq("id", ORDER_ID);
console.log("order 103 status after the run:", check.data?.[0]?.status);
