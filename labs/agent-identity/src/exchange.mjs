import { SignJWT, jwtVerify } from "jose";
import { randomUUID } from "node:crypto";
import { loadRegister } from "./register.mjs";
import { privateKey, publicKey } from "./keys.mjs";
import { ISSUER } from "./issuer.mjs";

export const ORDER = "spiffe://storefront.local/agents/order";
export const PAYMENT = "spiffe://storefront.local/agents/payment";
const MAX_TTL_SECONDS = 120;

const keyName = (agent) => agent.split("/").pop();

// Run by the agent itself: proves "I am this agent" using its own private key.
export async function makeActorAssertion(actor) {
  return new SignJWT({})
    .setProtectedHeader({ alg: "EdDSA" })
    .setIssuer(actor)
    .setSubject(actor)
    .setAudience(ISSUER)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime("60s")
    .sign(privateKey(keyName(actor)));
}

// Run by the issuer: swaps a token for a narrower one.
export async function exchangeToken({
  subjectToken,
  actor,
  actorAssertion,
  audience,
  scopes,
  orderId,
  register = loadRegister(),
}) {
  if (!register.has(actor)) throw new Error(`actor not in register: ${actor}`);
  const target = register.get(audience);
  if (!target) throw new Error(`audience not in register: ${audience}`);

  await jwtVerify(actorAssertion, publicKey(keyName(actor)), {
    issuer: actor,
    subject: actor,
    audience: ISSUER,
  });
  const { payload: parent } = await jwtVerify(
    subjectToken,
    publicKey("issuer"),
    {
      issuer: ISSUER,
      audience: actor,
    },
  );

  const parentScopes = parent.scope.split(" ");
  const wider = scopes.filter((s) => !parentScopes.includes(s));
  if (wider.length > 0) {
    throw new Error(`scope wider than parent token: ${wider.join(", ")}`);
  }
  const unregistered = scopes.filter((s) => !target.scopes.includes(s));
  if (unregistered.length > 0) {
    throw new Error(
      `scope not in register for ${audience}: ${unregistered.join(", ")}`,
    );
  }
  if (parent.order_id && orderId && orderId !== parent.order_id) {
    throw new Error("order_id differs from parent token");
  }
  const order_id = parent.order_id ?? orderId;

  const now = Math.floor(Date.now() / 1000);
  const exp = Math.min(now + MAX_TTL_SECONDS, parent.exp);
  const act = { sub: actor, ...(parent.act ? { act: parent.act } : {}) };

  return new SignJWT({
    scope: scopes.join(" "),
    act,
    ...(order_id ? { order_id } : {}),
  })
    .setProtectedHeader({ alg: "EdDSA" })
    .setIssuer(ISSUER)
    .setSubject(parent.sub)
    .setAudience(audience)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(privateKey("issuer"));
}
