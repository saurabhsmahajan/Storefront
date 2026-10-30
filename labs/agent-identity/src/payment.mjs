import { verifyAccess, actorChain } from "./verify.mjs";
import { PAYMENT } from "./exchange.mjs";

export function createPaymentAgent({ maxAmount = 5000 } = {}) {
  const charged = new Set();
  const usedTokens = new Set();
  const ledger = [];

  async function charge(token, { orderId, amount }) {
    const claims = await verifyAccess(token, {
      audience: PAYMENT,
      scope: "payment:charge",
      orderId,
    });
    if (usedTokens.has(claims.jti)) throw new Error("token already used");
    if (!Number.isFinite(amount) || amount <= 0 || amount > maxAmount) {
      throw new Error(`amount outside limit: ${amount}`);
    }
    if (charged.has(orderId))
      throw new Error(`order already charged: ${orderId}`);
    usedTokens.add(claims.jti);
    charged.add(orderId);
    ledger.push({
      type: "charge",
      orderId,
      amount,
      customer: claims.sub,
      actors: actorChain(claims),
    });
    return { status: "charged", orderId, amount };
  }

  async function refund(token, { orderId }) {
    await verifyAccess(token, {
      audience: PAYMENT,
      scope: "payment:refund",
      orderId,
    });
    throw new Error("refunds need human approval");
  }

  return { charge, refund, ledger };
}
