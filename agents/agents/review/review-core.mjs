// What the review screen shows and what a confirmation does. No HTTP, no HTML.
// source = { reviewerEmail, getOrder(id), getEvents(id) } reads RAW rows with the
// reviewer's own staff credentials (RLS decides what is visible).
import { validateHandoff } from "../lib/handoff.mjs";
import { sha256 } from "./approvals.mjs";

const FULL_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Only a refund recommendation can be approved here. A policy gap is shown for
// context, but a person decides it outside this screen.
export const APPROVABLE_TRIGGERS = ["refund_recommendation"];

export async function buildView(pkg, source) {
  const v = validateHandoff(pkg);
  if (!v.ok) return { ok: false, errors: v.errors };
  const id = pkg.order_id;
  let order = null;
  let events = [];
  if (id && FULL_UUID.test(id)) {
    order = await source.getOrder(id);
    events = order ? await source.getEvents(id) : [];
  }
  const blockers = [];
  if (!APPROVABLE_TRIGGERS.includes(pkg.trigger))
    blockers.push(
      `Trigger "${pkg.trigger}" cannot be approved on this screen.`,
    );
  if (!id) blockers.push("The package names no order.");
  else if (!order)
    blockers.push("The order was not found with your credentials.");
  const data = { package: pkg, order, events };
  return {
    ok: true,
    pkg,
    order,
    events,
    reviewer: source.reviewerEmail,
    digest: sha256(data),
    packageSha256: sha256(pkg),
    canApprove: blockers.length === 0,
    blockers,
  };
}

// The reviewer confirms what they saw. The records are read again and must match
// the digest on the page, otherwise nothing is approved.
export async function confirmApproval({
  pkg,
  source,
  store,
  viewDigest,
  acknowledged,
}) {
  if (acknowledged !== true)
    return {
      ok: false,
      code: "not_acknowledged",
      message: "Tick the box to confirm you reviewed the raw records.",
    };
  const view = await buildView(pkg, source);
  if (!view.ok)
    return {
      ok: false,
      code: "invalid_package",
      message: view.errors.join("; "),
    };
  if (!view.canApprove)
    return {
      ok: false,
      code: "not_approvable",
      message: view.blockers.join(" "),
    };
  if (!source.reviewerEmail)
    return {
      ok: false,
      code: "no_reviewer",
      message: "No signed-in reviewer.",
    };
  if (viewDigest !== view.digest)
    return {
      ok: false,
      code: "stale",
      message:
        "The records changed since this page loaded. Reload and review again.",
    };
  const approval = store.add({
    orderId: pkg.order_id,
    approvedBy: source.reviewerEmail,
    packageSha256: view.packageSha256,
    viewDigest: view.digest,
  });
  return { ok: true, approval };
}
