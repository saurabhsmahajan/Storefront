// Failure injection, router side (Step I, findings I12 and I14). Same stand-ins
// as failure-injection.mjs: the model SDK and the database module are scripted,
// everything else is the real code. Run with:
//   node --experimental-test-module-mocks agents/system/failure-injection-router.mjs
import fs from "node:fs";
import path from "node:path";
import { mock } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const url = (p) => pathToFileURL(path.join(here, p)).href;

class FakeAnthropic {
  constructor() {
    this.messages = { create: (args) => globalThis.__model(args) };
  }
}
mock.module("@anthropic-ai/sdk", { defaultExport: FakeAnthropic });
mock.module(url("../lib/db.mjs"), {
  namedExports: {
    getOrder: async () => null,
    getPayments: async () => [],
    clientFor: async () => ({}),
  },
});

const { handleMessage } = await import("./dispatch.mjs");
const { validateHandoff } = await import("../lib/handoff.mjs");

const ORD103 = "5eed0000-0000-4000-8000-000000000103";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const never = () => new Promise(() => {});
const stubClassify = (intent) => async () => ({ intent, raw: intent });
const noPlan = async () => ({ plan: null });
const okResult = (reply) => ({
  outcome: "resolved",
  reply,
  steps: [],
  escalation: null,
  forcedReason: null,
  toolErrors: 0,
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

const ROWS = [
  {
    id: "I12a",
    name: "The classifier call never returns",
    predicted: "FAIL: the session hangs",
    expected:
      "Escalated within routerTimeoutMs, trigger api_error, package from the router, no specialist called",
    async run() {
      globalThis.__model = never;
      const called = [];
      const out = await limited(
        handleMessage(`Where is my order ${ORD103}?`, {
          plan: noPlan,
          specialists: {
            order_status: async (input) => {
              called.push(input);
              return okResult("unused");
            },
          },
          routerTimeoutMs: 1500,
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
      const ok =
        ended(res) &&
        res.outcome === "escalated" &&
        res.handoff.trigger === "api_error" &&
        res.handoff.from === "router" &&
        called.length === 0 &&
        res.ms < 3500;
      return {
        ok,
        observed: `${brief(res)} specialists called=${called.length}`,
      };
    },
  },
  {
    id: "I12b",
    name: "The planner call never returns (the classifier answers)",
    predicted: "FAIL: the session hangs",
    expected:
      "The single path runs after routerTimeoutMs: resolved, the specialist receives the raw message unchanged",
    async run() {
      globalThis.__model = never;
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
          routerTimeoutMs: 1500,
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
      const ok =
        ended(res) &&
        res.outcome === "resolved" &&
        res.route === "order_status" &&
        got.length === 1 &&
        got[0] === message &&
        res.ms < 3500;
      return {
        ok,
        observed: `${brief(res)} specialist input identical to raw message=${got[0] === message}`,
      };
    },
  },
  {
    id: "I12c",
    name: "An explicit human request while the planner is slow (1200 ms, not hung)",
    predicted: "FAIL: the escalation waits for the planner",
    expected:
      "Escalated immediately: trigger explicit_human_request, under 600 ms, no specialist called",
    async run() {
      const called = [];
      const out = await limited(
        handleMessage("I want to talk to a human.", {
          classify: stubClassify("human_request"),
          plan: async () => {
            await sleep(1200);
            return { plan: null };
          },
          specialists: {
            order_status: async (input) => {
              called.push(input);
              return okResult("unused");
            },
          },
          routerTimeoutMs: 5000,
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
      const ok =
        ended(res) &&
        res.outcome === "escalated" &&
        res.handoff.trigger === "explicit_human_request" &&
        called.length === 0 &&
        res.ms < 600;
      return {
        ok,
        observed: `${brief(res)} specialists called=${called.length}`,
      };
    },
  },
];

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
  `# Failure injection log, router side (${stamp})`,
  "",
  "Plan and expectations: evidence/failure-injection-router-plan-2026-10-12.md, committed before the first run.",
  `Script: agents/system/failure-injection-router.mjs. Node ${process.version}.`,
  "Instrument: the real dispatch, loop, specialists, planner, classifier, escalation rules and handoff builder. The model SDK and the database module are replaced by scripted stand-ins. This tests the system's mechanics. It does not show how a real model behaves when it is slow.",
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
const file = path.join(
  root,
  "evidence",
  `failure-injection-router-log-${stamp}.md`,
);
fs.writeFileSync(file, out.join("\n"));
console.log(`Saved ${file}`);
process.exit(0);
