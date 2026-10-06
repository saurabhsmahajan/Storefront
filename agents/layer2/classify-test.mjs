import { loadTestSet } from "../lib/testset.mjs";
import { classifyIntent } from "./classify.mjs";

for (const row of loadTestSet()) {
  const { intent, raw, stop, types } = await classifyIntent(row.message);
  console.log(
    `#${row.id} [${row.category}] -> ${intent ?? `INVALID: "${raw}" stop=${stop} blocks=${types.join(",")}`}`,
  );
}
