import test from "node:test";
import assert from "node:assert/strict";
import {
  exchangeToken,
  makeActorAssertion,
  PAYMENT,
} from "../src/exchange.mjs";
import { createPaymentAgent } from "../src/payment.mjs";
import { SHOPPER } from "../src/issuer.mjs";
import {
  loginToken,
  orderToken,
  paymentToken,
  freshPaymentToken,
} from "../test-support/helpers.mjs";

test("refund relay, layer 1: the issuer will not give the shopper a refund token", async () => {
  const login = await loginToken();
  await assert.rejects(
    exchangeToken({
      subjectToken: login,
      actor: SHOPPER,
      actorAssertion: await makeActorAssertion(SHOPPER),
      audience: PAYMENT,
      scopes: ["payment:refund"],
      orderId: "1042",
    }),
    /wider than parent/,
  );
});

test("refund relay, layer 2: the issuer will not give the order agent a refund token", async () => {
  const orderTok = await orderToken(await loginToken());
  await assert.rejects(
    paymentToken(orderTok, ["payment:refund"]),
    /wider than parent/,
  );
});

test("refund relay, layer 3: the payment agent refuses even with a valid charge token", async () => {
  const payment = createPaymentAgent();
  await assert.rejects(
    payment.refund(await freshPaymentToken(), { orderId: "1042" }),
    /missing scope: payment:refund/,
  );
});

test("KNOWN GAP (closed in a later step): the shopper can skip the order agent", async () => {
  const token = await exchangeToken({
    subjectToken: await loginToken(),
    actor: SHOPPER,
    actorAssertion: await makeActorAssertion(SHOPPER),
    audience: PAYMENT,
    scopes: ["payment:charge"],
    orderId: "1042",
  });
  assert.ok(token);
});
