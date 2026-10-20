import test from "node:test";
import assert from "node:assert/strict";
import { scanText, PATTERNS } from "./scan-secrets.mjs";

// Fake keys are assembled at run time so this file never contains a full key-shaped string.
const fake = {
  supabase: "sb_" + "secret_" + "A".repeat(24),
  anthropic: "sk-" + "ant-" + "a1".repeat(15),
  github: "gh" + "p_" + "a1".repeat(18),
  aws: "AK" + "IA" + "ABCDEFGH12345678",
  privateKey: "-----BEGIN " + "RSA PRIVATE KEY-----",
  jwt: ["eyJ" + "a".repeat(20), "eyJ" + "b".repeat(20), "c".repeat(20)].join(
    ".",
  ),
};

test("each pattern catches its fake key", () => {
  for (const [kind, value] of Object.entries(fake)) {
    const hits = scanText(`KEY=${value}`);
    assert.ok(hits.length >= 1, `${kind} not caught`);
  }
});

test("a hit reports the pattern and line, never the value", () => {
  const hits = scanText(`line one\nSECRET=${fake.supabase}\n`);
  assert.deepEqual(hits, [{ name: "Supabase secret key", line: 2 }]);
  assert.equal(JSON.stringify(hits).includes("AAAA"), false);
});

test("ordinary text and short look-alikes are not flagged", () => {
  for (const t of [
    "SUPABASE_URL=https://example.supabase.co",
    "see sb_secret_ in the notes",
    "the sk-ant prefix is used for Anthropic keys",
    "commit a03430c and order 5eed0000-0000-4000-8000-0000000001a1",
    "sha256 3f2a9c1e5b7d4e8a9c217d4e5f6a8b90",
  ])
    assert.deepEqual(scanText(t), [], t);
});

test("there is at least one pattern per key family we use", () => {
  const names = PATTERNS.map((p) => p[0]).join(" ");
  for (const k of ["Supabase", "Anthropic", "GitHub", "Adyen", "Private key"])
    assert.match(names, new RegExp(k));
});
