// Failure injection (Step I). Runs eleven rows against the real dispatch,
// loop, specialists, planner, classifier and escalation code. The model SDK
// and the database module are replaced by scripted stand-ins, so every failure
// is exact and repeatable and nothing is spent. Run with:
//   node --experimental-test-module-mocks agents/system/failure-injection.mjs
import fs from "node:fs";
import path from "node:path";
import { mock } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const url = (p) => pathToFileURL(path.join(here, p)).href;

// --- stand-ins, installed before any agent module is imported ----------------
class FakeAnthropic {
  constructor() {
    this.messages = { create: (args) => globalThis.__model(args) };
  }
}
mock.module("@anthropic-ai/sdk", { defaultExport: FakeAnthropic });

const DB = {
  getOrder: async () => null,
  getPayments: async () => [],
};
mock.module(url("../lib/db.mjs"), {
  namedExports: {
    getOrder: (...a) => DB.getOrder(...a),
    getPayments: (...a) => DB.getPayments(...a),
    clientFor: async () => ({}),
  },
});

const { handleMessage } = await import("./dispatch.mjs");
const { runOrderStatus } = await import("../specialists/order-status.mjs");
const { validateHandoff } = await import("../lib/handoff.mjs");
const { FALLBACK_REPLY } = await import("../lib/loop.mjs");
const MAPPING = JSON.parse(
  fs.readFileSync(
    path.join(here, "..", "data", "decline-reasons.json"),
    "utf8",
  ),
);

// --- helpers ------------------------------------------------------------------
const ORD103 = "5eed0000-0000-4000-8000-000000000103";
const ORD107 = "5eed0000-0000-4000-8000-000000000107";
const ORD999 = "5eed0000-0000-4000-8000-000000000999";

const toolUse = (name, input, id = "tu_1") => ({
  content: [{ type: "tool_use", id, name, input }],
  stop_reason: "tool_use",
});
const text = (t) => ({
  content: [{ type: "text", text: t }],
  stop_reason: "end_turn",
});

// Script the model: each call takes the next response (an Error is thrown).
// Returns the tool results the model was shown, in order.
function script(steps) {
  const shown = [];
  let i = 0;
  globalThis.__model = async (args) => {
    const last = args.messages.at(-1);
    if (Array.isArray(last?.content)) {
      for (const b of last.content) {
        if (b.type === "tool_result") {
          shown.push({ content: b.content, is_error: Boolean(b.is_error) });
        }
      }
    }
    const s = steps[Math.min(i++, steps.length - 1)];
    if (s instanceof Error) throw s;
    return s;
  };
  return shown;
}
const stubClassify = (intent) => async () => ({ intent, raw: intent });
const noPlan = async () => ({ plan: null });
const okResult = (reply, extra = {}) => ({
  outcome: "resolved",
  reply,
  steps: [],
  escalation: null,
  forcedReason: null,
  toolErrors: 0,
  ...extra,
});

async function limited(promise, ms) {
  let timer;
  const clock = new Promise((resolve) => {
    timer = setTimeout(() => resolve({ hung: true }), ms);
  });
  const settled = promise.then(
    (res) => ({ res }),
    (err) => ({ threw: err }),
  );
  const out = await Promise.race([settled, clock]);
  clearTimeout(timer);
  return out;
}

const ended = (res) =>
  Boolean(res) &&
  ["resolved", "escalated"].includes(res.outcome) &&
  (res.outcome === "resolved" ||
    (res.handoff && validateHandoff(res.handoff).ok));
const brief = (res) =>
  `outcome=${res.outcome} route=${res.route}` +
  (res.handoff
    ? ` trigger=${res.handoff.trigger} from=${res.handoff.from} to=${res.handoff.to}`
    : "") +
  ` steps=${(res.steps ?? []).length} ms=${res.ms}`;

// --- the eleven rows ------------------------------------------------------------
const ROWS = [
  {
    id: "I1",
    name: "A tool call that never returns (single path)",
    predicted: "FAIL: the session hangs",
    expected: "Session ends resolved or escalated, with a valid package",
    async run() {
      DB.getOrder = () => new Promise(() => {});
      script([toolUse("get_order_status", { order_id: ORD103 })]);
      const out = await limited(
        handleMessage(`Where is my order ${ORD103}?`, {
          classify: stubClassify("order_status"),
          plan: noPlan,
        }),
        4000,
      );
      if (out.hung) {
        return {
          ok: false,
          observed: "no result after 4000 ms: the session hangs",
        };
      }
      const res = out.res;
      return { ok: ended(res), observed: brief(res) };
    },
  },
  {
    id: "I2",
    name: "A tool call that never returns (split path)",
    predicted: "PASS",
    expected:
      "Escalated, trigger specialist_error, within timeoutMs, other part answered, failed part in unanswered",
    async run() {
      DB.getOrder = () => new Promise(() => {});
      script([toolUse("get_order_status", { order_id: ORD103 })]);
      const message = `Where is order ${ORD103}? Can I get a refund?`;
      const plan = {
        subtasks: [
          {
            id: "s1",
            specialist: "order_status",
            question: `Where is order ${ORD103}?`,
            order_ref: 0,
          },
          {
            id: "s2",
            specialist: "refund",
            question: "Can I get a refund?",
            order_ref: 0,
          },
        ],
        unrouted: [],
      };
      const out = await limited(
        handleMessage(message, {
          classify: stubClassify("order_status"),
          plan: async () => ({ plan }),
          specialists: {
            order_status: runOrderStatus,
            refund: async () =>
              okResult("Refund stub answer.", {
                decision: {
                  verdict: "not_eligible",
                  reason: "never_paid",
                  facts: {},
                },
              }),
          },
          timeoutMs: 1500,
        }),
        10000,
      );
      if (out.hung)
        return { ok: false, observed: "no result after 10000 ms: hang" };
      const res = out.res;
      const unanswered = res.handoff?.context?.unanswered ?? [];
      const ok =
        ended(res) &&
        res.outcome === "escalated" &&
        res.handoff.trigger === "specialist_error" &&
        res.ms < 4000 &&
        unanswered.length === 1 &&
        res.reply.includes("Refund stub answer.");
      return { ok, observed: `${brief(res)} unanswered=${unanswered.length}` };
    },
  },
  {
    id: "I3",
    name: "A lookup that finds nothing for a real order ID (order status)",
    predicted: "PASS",
    expected:
      "Resolved, no escalation, the model is shown exactly {found:false} and nothing else about the order",
    async run() {
      DB.getOrder = async () => null;
      const shown = script([
        toolUse("get_order_status", { order_id: ORD103 }),
        text("I couldn't find an order with that ID. Please check it."),
      ]);
      const out = await limited(
        handleMessage(`Where is order ${ORD103}?`, {
          classify: stubClassify("order_status"),
          plan: noPlan,
        }),
        20000,
      );
      if (out.hung || out.threw)
        return { ok: false, observed: "hang or throw" };
      const res = out.res;
      const ok =
        ended(res) &&
        res.outcome === "resolved" &&
        shown.length === 1 &&
        shown[0].content === '{"found":false}';
      return {
        ok,
        observed: `${brief(res)} model was shown: ${shown[0]?.content}`,
      };
    },
  },
  {
    id: "I4",
    name: "A lookup that finds nothing (refund, no order)",
    predicted: "PASS",
    expected: "Resolved, verdict not_found, no escalation, no package",
    async run() {
      DB.getOrder = async () => null;
      script([
        toolUse("check_refund_eligibility", { order_id: ORD999 }),
        text("I couldn't find that order."),
      ]);
      const { runRefund } = await import("../specialists/refund.mjs");
      const out = await limited(
        handleMessage(`Can I get a refund on order ${ORD999}?`, {
          classify: stubClassify("refund"),
          plan: noPlan,
          specialists: { refund: runRefund },
        }),
        20000,
      );
      if (out.hung || out.threw)
        return { ok: false, observed: "hang or throw" };
      const res = out.res;
      const ok =
        ended(res) &&
        res.outcome === "resolved" &&
        res.decision?.verdict === "not_found" &&
        !res.handoff;
      return { ok, observed: `${brief(res)} verdict=${res.decision?.verdict}` };
    },
  },
  {
    id: "I5",
    name: "Malformed payment events (decline): no payload, no reason, unknown and odd reasons",
    predicted: "PASS",
    expected:
      "No crash. Every failed attempt gets the never_tell text. No raw reason reaches the model.",
    async run() {
      DB.getPayments = async () => [
        { event_type: "AUTHORISATION", payload: null },
        { event_type: "AUTHORISATION", payload: { success: "false" } },
        {
          event_type: "AUTHORISATION",
          payload: { success: "false", reason: "SOMETHING NEW" },
        },
        {
          event_type: "AUTHORISATION",
          payload: { success: "false", reason: { nested: 1 } },
        },
        {
          event_type: "AUTHORISATION",
          payload: { success: "false", reason: "FRAUD" },
        },
      ];
      const shown = script([
        toolUse("get_decline_info", { order_id: ORD107 }),
        text("Here is what I found."),
      ]);
      const { runDecline } = await import("../specialists/decline.mjs");
      const out = await limited(
        handleMessage(`Why did my payment fail on ${ORD107}?`, {
          classify: stubClassify("decline"),
          plan: noPlan,
          specialists: { decline: runDecline },
        }),
        20000,
      );
      if (out.hung || out.threw)
        return { ok: false, observed: "hang or throw" };
      const res = out.res;
      const seen = shown[0]?.content ?? "";
      let parsed = null;
      try {
        parsed = JSON.parse(seen);
      } catch {
        // stays null
      }
      const attempts = parsed?.declined_attempts ?? [];
      const allGeneric =
        attempts.length === 4 &&
        attempts.every((a) => a.explanation === MAPPING.tiers.never_tell);
      const leak =
        /fraud|acquirer|cvc|expired|balance|something new|nested/i.test(seen);
      const ok = ended(res) && allGeneric && !leak;
      return {
        ok,
        observed: `${brief(res)} declined_attempts=${attempts.length} all_generic=${allGeneric} raw_leak=${leak}`,
      };
    },
  },
  {
    id: "I6",
    name: "Malformed order lookup: the database returns a string, not an order",
    predicted: "UNKNOWN",
    expected:
      "No crash. The tool errors are counted. Two errors escalate with tool_failure. The customer never sees a made-up status.",
    async run() {
      DB.getOrder = async () => "garbage";
      const shown = script([
        toolUse("get_order_status", { order_id: ORD103 }, "tu_1"),
        toolUse("get_order_status", { order_id: ORD103 }, "tu_2"),
        text("I couldn't read this order, so I can't tell you its status."),
      ]);
      const out = await limited(
        handleMessage(`Where is order ${ORD103}?`, {
          classify: stubClassify("order_status"),
          plan: noPlan,
        }),
        20000,
      );
      if (out.hung || out.threw)
        return { ok: false, observed: "hang or throw" };
      const res = out.res;
      const errors = shown.filter((s) => s.is_error).length;
      const ok =
        ended(res) &&
        errors === 2 &&
        res.outcome === "escalated" &&
        res.handoff.trigger === "tool_failure";
      return {
        ok,
        observed: `${brief(res)} tool errors shown=${errors} first error: ${shown[0]?.content}`,
      };
    },
  },
  {
    id: "I7",
    name: "A specialist that returns nothing (undefined)",
    predicted: "UNKNOWN",
    expected: "Escalated, trigger specialist_error, valid package",
    async run() {
      script([text("unused")]);
      const out = await limited(
        handleMessage(`Where is order ${ORD103}?`, {
          classify: stubClassify("order_status"),
          plan: noPlan,
          specialists: { order_status: async () => undefined },
        }),
        20000,
      );
      if (out.hung || out.threw)
        return { ok: false, observed: "hang or throw" };
      const res = out.res;
      const ok =
        ended(res) &&
        res.outcome === "escalated" &&
        res.handoff?.trigger === "specialist_error";
      return { ok, observed: brief(res) };
    },
  },
  {
    id: "I8",
    name: "A specialist whose final reply is empty",
    predicted: "PASS",
    expected: "Escalated, trigger empty_reply, the fixed fallback reply",
    async run() {
      DB.getOrder = async () => ({
        status: "paid",
        total_minor: 159900,
        currency: "INR",
        created_at: "2026-10-02T14:53:46.970894+00:00",
      });
      script([
        toolUse("get_order_status", { order_id: ORD103 }),
        { content: [], stop_reason: "end_turn" },
      ]);
      const out = await limited(
        handleMessage(`Where is order ${ORD103}?`, {
          classify: stubClassify("order_status"),
          plan: noPlan,
        }),
        20000,
      );
      if (out.hung || out.threw)
        return { ok: false, observed: "hang or throw" };
      const res = out.res;
      const ok =
        ended(res) &&
        res.outcome === "escalated" &&
        res.handoff.trigger === "empty_reply" &&
        res.reply === FALLBACK_REPLY;
      return { ok, observed: brief(res) };
    },
  },
  {
    id: "I9",
    name: "A model API error inside a specialist loop (refund)",
    predicted: "PASS",
    expected: "Escalated, trigger api_error, the fixed fallback reply",
    async run() {
      script([new Error("529 overloaded_error")]);
      const { runRefund } = await import("../specialists/refund.mjs");
      const out = await limited(
        handleMessage(`Can I get a refund on order ${ORD103}?`, {
          classify: stubClassify("refund"),
          plan: noPlan,
          specialists: { refund: runRefund },
        }),
        20000,
      );
      if (out.hung || out.threw)
        return { ok: false, observed: "hang or throw" };
      const res = out.res;
      const ok =
        ended(res) &&
        res.outcome === "escalated" &&
        res.handoff.trigger === "api_error" &&
        res.reply === FALLBACK_REPLY;
      return { ok, observed: brief(res) };
    },
  },
  {
    id: "I10",
    name: "A model API error in the planner only",
    predicted: "PASS",
    expected:
      "The single path runs as today: resolved, the specialist receives the raw message unchanged",
    async run() {
      globalThis.__model = async (args) => {
        if (args.tools?.[0]?.name === "submit_plan") {
          throw new Error("planner outage");
        }
        throw new Error("unexpected model call");
      };
      const message = `Where is order ${ORD103}?`;
      const got = [];
      const out = await limited(
        handleMessage(message, {
          classify: stubClassify("order_status"),
          specialists: {
            order_status: async (input) => {
              got.push(input);
              return okResult("Stub order status answer.");
            },
          },
        }),
        20000,
      );
      if (out.hung || out.threw)
        return { ok: false, observed: "hang or throw" };
      const res = out.res;
      const ok =
        ended(res) &&
        res.outcome === "resolved" &&
        res.route === "order_status" &&
        got.length === 1 &&
        got[0] === message;
      return {
        ok,
        observed: `${brief(res)} specialist input identical to raw message=${got[0] === message}`,
      };
    },
  },
  {
    id: "I11",
    name: "A model API error in the planner and the classifier",
    predicted: "PASS",
    expected: "Escalated, trigger api_error, no steps, package from the router",
    async run() {
      globalThis.__model = async () => {
        throw new Error("model API outage");
      };
      const out = await limited(
        handleMessage(`Where is order ${ORD103}?`),
        20000,
      );
      if (out.hung || out.threw)
        return { ok: false, observed: "hang or throw" };
      const res = out.res;
      const ok =
        ended(res) &&
        res.outcome === "escalated" &&
        res.handoff.trigger === "api_error" &&
        res.handoff.from === "router" &&
        (res.steps ?? []).length === 0;
      return { ok, observed: brief(res) };
    },
  },
];

// --- run and report -------------------------------------------------------------
const results = [];
for (const row of ROWS) {
  let r;
  try {
    r = await row.run();
  } catch (err) {
    r = { ok: false, observed: `script error: ${err.message}` };
  }
  results.push({ ...row, ...r });
  console.log(
    `${row.id} | ${r.ok ? "PASS" : "FAIL"} | predicted ${row.predicted} | ${row.name}\n    ${r.observed}`,
  );
}

const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed} of ${results.length} rows passed`);

const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
const out = [
  `# Failure injection log (${stamp})`,
  "",
  `Plan and expectations: evidence/failure-injection-plan-2026-10-06.md, committed before this run.`,
  `Script: agents/system/failure-injection.mjs. Node ${process.version}.`,
  "Instrument: the real dispatch, loop, specialists, planner, classifier, escalation rules and handoff builder. The model SDK and the database module are replaced by scripted stand-ins, so each failure is exact and repeatable. This tests the system's mechanics. It does not show how a real model words a reply after a failure.",
  "",
  "| # | Failure | Predicted | Expected | Observed | Result |",
  "|---|---|---|---|---|---|",
  ...results.map(
    (r) =>
      `| ${r.id} | ${r.name} | ${r.predicted} | ${r.expected} | ${String(r.observed).replace(/\|/g, "/")} | ${r.ok ? "PASS" : "FAIL"} |`,
  ),
  "",
  `${passed} of ${results.length} rows passed.`,
  "",
];
const file = path.join(root, "evidence", `failure-injection-log-${stamp}.md`);
fs.writeFileSync(file, out.join("\n"));
console.log(`Saved ${file}`);
process.exit(0);
