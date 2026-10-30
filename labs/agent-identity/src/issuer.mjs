import { SignJWT } from "jose";
import { randomUUID } from "node:crypto";
import { loadRegister } from "./register.mjs";
import { privateKey } from "./keys.mjs";

export const ISSUER = "spiffe://storefront.local/issuer";
export const SHOPPER = "spiffe://storefront.local/agents/shopper";
const LOGIN_TTL_SECONDS = 300;

export async function issueLoginToken({
  customer,
  scopes,
  audience = SHOPPER,
  register = loadRegister(),
}) {
  const entry = register.get(audience);
  if (!entry) throw new Error(`audience not in register: ${audience}`);
  const notAllowed = scopes.filter((s) => !entry.scopes.includes(s));
  if (notAllowed.length > 0) {
    throw new Error(
      `scope not in register for ${audience}: ${notAllowed.join(", ")}`,
    );
  }
  return new SignJWT({ scope: scopes.join(" ") })
    .setProtectedHeader({ alg: "EdDSA" })
    .setIssuer(ISSUER)
    .setSubject(`customer:${customer}`)
    .setAudience(audience)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime(`${LOGIN_TTL_SECONDS}s`)
    .sign(privateKey("issuer"));
}
