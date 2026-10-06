import { classifyIntent } from "../layer2/classify.mjs";
import { FALLBACK_REPLY } from "../lib/loop.mjs";
import { runOrderStatus } from "../specialists/order-status.mjs";
import { runDecline } from "../specialists/decline.mjs";
import { runRefund } from "../specialists/refund.mjs";

const SPECIALISTS = {
  order_status: runOrderStatus,
  decline: runDecline,
  refund: runRefund,
};
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const HUMAN_REPLY =
  "I'm passing you to a human agent now. They'll pick up from here.";
const OUT_OF_SCOPE_REPLY =
  "I can help with order status, payment problems and refunds. If you have an order ID, send it and I'll look into it. If you'd like to talk to a person, tell me and I'll pass you to a human agent.";

// Every exit returns outcome "resolved" or "escalated".
export async function handleMessage(message) {
  const t0 = Date.now();
  const done = (route, r) => ({ route, ms: Date.now() - t0, ...r });
  const fallback = (route, reason) =>
    done(route, {
      outcome: "escalated",
      reply: FALLBACK_REPLY,
      steps: [],
      escalation: { reason, by: "code" },
      forced: true,
    });

  let route;
  try {
    route = (await classifyIntent(message)).intent;
  } catch (err) {
    return fallback("router_error", `router_error: ${err.message}`);
  }
  if (!route) return fallback("unknown", "router_returned_no_valid_label");

  if (route === "human_request") {
    const orderId = message.match(UUID)?.[0];
    return done(route, {
      outcome: "escalated",
      reply: HUMAN_REPLY,
      steps: [],
      escalation: {
        reason: `Customer asked for a human.${orderId ? ` Order ${orderId} mentioned.` : ""}`,
        by: "code",
      },
    });
  }
  if (route === "out_of_scope") {
    return done(route, {
      outcome: "resolved",
      reply: OUT_OF_SCOPE_REPLY,
      steps: [],
      escalation: null,
    });
  }

  const run = SPECIALISTS[route];
  if (!run) return fallback(route, `no_specialist_for_route: ${route}`);
  try {
    return done(route, await run(message));
  } catch (err) {
    return fallback(route, `specialist_error: ${err.message}`);
  }
}
