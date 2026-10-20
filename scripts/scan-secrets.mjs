// Fails (exit 1) when a tracked file, or a line added in git history, matches a known
// key pattern. Prints the pattern name, file and line number. Never prints the value.
// Run from the repo root:
//   node scripts/scan-secrets.mjs            scan files tracked at HEAD
//   node scripts/scan-secrets.mjs --history  also scan every line added in any commit
// Limit: it knows key SHAPES. A random password with no recognisable shape is not caught.
// scripts/check-env-values-not-committed.mjs covers that case on a machine that has a .env.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const PATTERNS = [
  ["Supabase secret key", /sb_secret_[A-Za-z0-9_-]{16,}/],
  [
    "Supabase legacy service or anon JWT",
    /eyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}/,
  ],
  ["Anthropic API key", /sk-ant-[A-Za-z0-9_-]{20,}/],
  ["OpenAI-style API key", /\bsk-[A-Za-z0-9]{32,}\b/],
  ["GitHub token", /\bgh[pousr]_[A-Za-z0-9]{36,}\b/],
  ["GitHub fine-grained token", /\bgithub_pat_[A-Za-z0-9_]{50,}\b/],
  ["AWS access key id", /\bAKIA[0-9A-Z]{16}\b/],
  ["Adyen API key", /\bAQE[A-Za-z0-9+/=_-]{40,}/],
  [
    "Private key block",
    /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/,
  ],
];

// Returns [{ name, line }] for each line that matches. Values are never returned.
export function scanText(text) {
  const hits = [];
  text.split(/\r?\n/).forEach((l, i) => {
    for (const [name, re] of PATTERNS) {
      if (re.test(l)) hits.push({ name, line: i + 1 });
    }
  });
  return hits;
}

function scanTracked() {
  const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
    .split("\0")
    .filter(Boolean)
    .filter((f) => !f.endsWith("package-lock.json") && fs.existsSync(f));
  const out = [];
  for (const f of files) {
    let text;
    try {
      text = fs.readFileSync(f, "utf8");
    } catch {
      continue;
    }
    if (text.includes("\0")) continue; // binary
    for (const h of scanText(text)) out.push({ where: `${f}:${h.line}`, ...h });
  }
  return out;
}

function scanHistory() {
  const log = execFileSync(
    "git",
    ["log", "--all", "-p", "--no-color", "--format=commit %h", "-U0"],
    { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 },
  );
  const out = [];
  let commit = "?";
  let file = "?";
  for (const l of log.split(/\r?\n/)) {
    if (l.startsWith("commit ")) commit = l.slice(7);
    else if (l.startsWith("+++ ")) file = l.slice(6);
    else if (l.startsWith("+") && !l.startsWith("+++")) {
      for (const [name, re] of PATTERNS)
        if (re.test(l)) out.push({ where: `history ${commit} ${file}`, name });
    }
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const hits = [
    ...scanTracked(),
    ...(process.argv.includes("--history") ? scanHistory() : []),
  ];
  if (hits.length) {
    console.error(
      `Secrets scan FAILED: ${hits.length} match(es). Values are not printed.`,
    );
    for (const h of hits) console.error(`  ${h.name}  ${h.where}`);
    process.exit(1);
  }
  console.log(
    `Secrets scan passed${process.argv.includes("--history") ? " (files and history)" : ""}.`,
  );
}
