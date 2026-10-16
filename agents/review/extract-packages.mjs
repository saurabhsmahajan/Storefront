// Copies complete handoff packages out of a run file into the review inbox.
// Usage: node agents/review/extract-packages.mjs evidence/week-3-sdk-agent-run-v2-<date>.md
import fs from "node:fs";
import path from "node:path";
import { INBOX } from "./server.mjs";

const file = process.argv[2];
if (!file) throw new Error("Pass the run file path.");
const text = fs.readFileSync(file, "utf8");
fs.mkdirSync(INBOX, { recursive: true });
let n = 0;
let skipped = 0;
for (const sec of text.split(/\n## /).slice(1)) {
  const num = sec.match(/^(\d+)\./)?.[1];
  const block = sec
    .split("Handoff package:")[1]
    ?.match(/```json\n([\s\S]*?)\n```/)?.[1];
  if (!num || !block || block.trim() === "null") continue;
  try {
    const pkg = JSON.parse(block);
    const out = path.join(
      INBOX,
      `message-${String(num).padStart(2, "0")}-${pkg.trigger}.json`,
    );
    fs.writeFileSync(out, JSON.stringify(pkg, null, 1));
    n++;
  } catch {
    skipped++;
  }
}
console.log(
  `Wrote ${n} package(s) to ${INBOX}. Skipped ${skipped} that were cut off in the run file.`,
);
