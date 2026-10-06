import test from "node:test";
import assert from "node:assert/strict";
import {
  mergeReplies,
  handoffLineFor,
  REFUND_RECOMMENDATION_LINE,
  POLICY_GAP_LINE,
  UNANSWERED_PREFIX,
} from "./merge.mjs";
import { FALLBACK_REPLY } from "./loop.mjs";

const ok = (id, reply) => ({ id, status: "answered", reply });

test("answered replies are joined in the given order with a blank line", () => {
  const out = mergeReplies({
    results: [ok("s1", "First."), ok("s2", "Second."), ok("s3", "Third.")],
  });
  assert.equal(out, "First.\n\nSecond.\n\nThird.");
  const reversed = mergeReplies({
    results: [ok("s3", "Third."), ok("s1", "First.")],
  });
  assert.equal(reversed, "Third.\n\nFirst.");
});

test("failed, skipped and not_run replies are left out", () => {
  const out = mergeReplies({
    results: [
      ok("s1", "Kept."),
      { id: "s2", status: "failed", reply: "partial text" },
      { id: "s3", status: "skipped", reply: "x" },
      { id: "s4", status: "not_run", reply: null },
    ],
  });
  assert.equal(out, "Kept.");
});

test("one handoff line only, however many subtasks escalated", () => {
  const out = mergeReplies({
    results: [ok("s1", "A."), ok("s2", "B."), ok("s3", "C.")],
    sessionTrigger: "refund_recommendation",
  });
  assert.equal(out, `A.\n\nB.\n\nC.\n\n${REFUND_RECOMMENDATION_LINE}`);
  assert.equal(out.split(REFUND_RECOMMENDATION_LINE).length, 2);
  assert.equal(out.split(FALLBACK_REPLY).length, 1);
});

test("handoff line per trigger: two fixed lines, FALLBACK_REPLY otherwise", () => {
  assert.equal(
    handoffLineFor("refund_recommendation"),
    REFUND_RECOMMENDATION_LINE,
  );
  assert.equal(handoffLineFor("policy_gap"), POLICY_GAP_LINE);
  for (const t of [
    "api_error",
    "step_cap",
    "empty_reply",
    "unexpected_stop",
    "specialist_error",
    "tool_failure",
  ]) {
    assert.equal(handoffLineFor(t), FALLBACK_REPLY, t);
  }
  assert.equal(
    mergeReplies({ results: [ok("s1", "A.")], sessionTrigger: "policy_gap" }),
    `A.\n\n${POLICY_GAP_LINE}`,
  );
});

test("no handoff line when there is no session trigger", () => {
  assert.equal(
    mergeReplies({ results: [ok("s1", "A.")], sessionTrigger: null }),
    "A.",
  );
});

test("one fixed line per unanswered part, after the answers, before the handoff line", () => {
  const out = mergeReplies({
    results: [ok("s1", "Status answer."), { id: "s2", status: "failed" }],
    unanswered: [
      { part: "why did my payment fail", reason: "specialist_failed" },
      { part: "can I get a refund?", reason: "dependency_failed" },
    ],
    sessionTrigger: "specialist_error",
  });
  assert.equal(
    out,
    [
      "Status answer.",
      `I couldn't check this part just now: "why did my payment fail"`,
      `I couldn't check this part just now: "can I get a refund?"`,
      FALLBACK_REPLY,
    ].join("\n\n"),
  );
  assert.equal(UNANSWERED_PREFIX, "I couldn't check this part just now: ");
});

test("nothing answered: FALLBACK_REPLY only", () => {
  const out = mergeReplies({
    results: [
      { id: "s1", status: "failed", reply: "half a sentence" },
      { id: "s2", status: "not_run" },
    ],
    unanswered: [
      { part: "Where is order", reason: "specialist_failed" },
      { part: "can I get a refund?", reason: "dependency_failed" },
    ],
    sessionTrigger: "specialist_error",
  });
  assert.equal(out, FALLBACK_REPLY);
  assert.equal(mergeReplies({ results: [] }), FALLBACK_REPLY);
});

test("specialist reply bytes are untouched", () => {
  const a =
    "  I found **three** declined attempts:\n\n- **Attempt 1:**  The bank declined.\n- Attempt 2:\tsame\n\n";
  const b = "\nOrder `5eed…103` is *paid*.   \r\n> quoted line\n";
  const out = mergeReplies({
    results: [ok("s1", a), ok("s2", b)],
    sessionTrigger: "refund_recommendation",
  });
  assert.equal(out, a + "\n\n" + b + "\n\n" + REFUND_RECOMMENDATION_LINE);
  assert.ok(out.startsWith(a));
  assert.equal(out.slice(a.length + 2, a.length + 2 + b.length), b);
});

test("a reply containing FRAUD passes through unchanged", () => {
  // The merge does not filter. Disclosure is enforced before any reply exists:
  // the decline specialist only ever sees mapped, customer-safe explanations
  // (explain() in agents/specialists/decline.mjs), so filtering here would hide
  // a leak upstream rather than prevent it. The leak check runs on the merged
  // reply in the system run, not inside the merge.
  const reply = "Raw reason: FRAUD. Acquirer Fraud on attempt 2.";
  const out = mergeReplies({ results: [ok("s1", reply), ok("s2", "Other.")] });
  assert.equal(out, `${reply}\n\nOther.`);
  assert.ok(out.includes("FRAUD"));
});
