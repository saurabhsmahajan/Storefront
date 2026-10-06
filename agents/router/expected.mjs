import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export function loadExpectedRoutes() {
  const text = fs.readFileSync(
    path.join(
      here,
      "..",
      "..",
      "evidence",
      "router-expected-routes-2026-10-06.md",
    ),
    "utf8",
  );
  const expected = {};
  for (const line of text.split("\n").map((l) => l.trim())) {
    if (/^\|\s*\d+\s*\|/.test(line)) {
      const c = line.split("|").map((x) => x.trim());
      expected[c[1]] = c[3].split(",").map((x) => x.trim());
    }
  }
  if (Object.keys(expected).length !== 21) {
    throw new Error("Expected 21 routes in the answer key");
  }
  return expected;
}
