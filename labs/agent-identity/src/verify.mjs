import { jwtVerify } from "jose";
import { ISSUER } from "./issuer.mjs";
import { publicKey } from "./keys.mjs";

// Every service runs this on every token it receives.
export async function verifyAccess(token, { audience, scope, orderId }) {
  const { payload } = await jwtVerify(token, publicKey("issuer"), {
    issuer: ISSUER,
    audience,
  });
  if (!payload.scope.split(" ").includes(scope)) {
    throw new Error(`missing scope: ${scope}`);
  }
  if (orderId && payload.order_id !== orderId) {
    throw new Error(`token is not valid for order ${orderId}`);
  }
  return payload;
}

// Flattens the nested act claim into a list, newest actor first.
export function actorChain(claims) {
  const out = [];
  let a = claims.act;
  while (a) {
    out.push(a.sub);
    a = a.act;
  }
  return out;
}
