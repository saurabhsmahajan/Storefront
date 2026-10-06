// Subtask plan for mixed requests: pure validation, no model, no I/O.
// The Router proposes a plan; nothing runs unless validatePlan says ok.
// Questions and unrouted text must be verbatim spans of the customer's
// message, so the Router cannot put words in the customer's mouth. Order IDs
// are referenced by index into the IDs code found, never typed by the Router.

export const PLAN_SPECIALISTS = ["order_status", "decline", "refund"];
export const MAX_SUBTASKS = 3;
export const UNROUTED_LABELS = ["out_of_scope", "human_request"];

const PLAN_KEYS = ["subtasks", "unrouted"];
const SUBTASK_KEYS = ["id", "specialist", "question", "order_ref"];
const UNROUTED_KEYS = ["text", "label"];

// Same pattern as agents/system/dispatch.mjs, global so every ID is found.
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

// All order IDs in the message, in order of first appearance, no duplicates.
// IDs that differ only in letter case count as the same ID.
export function findOrderIds(message) {
  const seen = new Set();
  const ids = [];
  for (const [id] of String(message ?? "").matchAll(UUID)) {
    const key = id.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    ids.push(id);
  }
  return ids;
}

const collapse = (s) => s.replace(/\s+/g, " ");
const isObject = (v) =>
  v !== null && typeof v === "object" && !Array.isArray(v);

function unknownKeys(obj, allowed, where, errors) {
  for (const k of Object.keys(obj)) {
    if (!allowed.includes(k)) errors.push(`${where}: unknown key "${k}"`);
  }
}

function checkSpan(value, message, where, field, errors) {
  if (typeof value !== "string" || !value.trim()) {
    errors.push(`${where}: ${field} must be a non-empty string`);
  } else if (!collapse(message).includes(collapse(value))) {
    errors.push(`${where}: ${field} is not a verbatim span of the message`);
  }
}

// Returns every error found, not just the first.
export function validatePlan(
  plan,
  { message = "", orderIds = [], classifiedRoute = null } = {},
) {
  const errors = [];
  if (!isObject(plan)) {
    return { ok: false, errors: ["plan must be an object"] };
  }
  unknownKeys(plan, PLAN_KEYS, "plan", errors);

  const { subtasks, unrouted } = plan;
  if (!Array.isArray(subtasks)) {
    errors.push("plan: subtasks must be an array");
  } else {
    if (subtasks.length < 1) errors.push("plan: needs at least 1 subtask");
    if (subtasks.length > MAX_SUBTASKS) {
      errors.push(
        `plan: ${subtasks.length} subtasks, the cap is ${MAX_SUBTASKS}`,
      );
    }
    const ids = new Set();
    subtasks.forEach((s, i) => {
      const where = `subtasks[${i}]`;
      if (!isObject(s)) {
        errors.push(`${where}: must be an object`);
        return;
      }
      unknownKeys(s, SUBTASK_KEYS, where, errors);
      if (typeof s.id !== "string" || !s.id.trim()) {
        errors.push(`${where}: id must be a non-empty string`);
      } else if (ids.has(s.id)) {
        errors.push(`${where}: duplicate id "${s.id}"`);
      } else {
        ids.add(s.id);
      }
      if (!PLAN_SPECIALISTS.includes(s.specialist)) {
        errors.push(`${where}: unknown specialist "${s.specialist}"`);
      }
      checkSpan(s.question, message, where, "question", errors);
      const ref = s.order_ref;
      if (
        ref !== null &&
        !(Number.isInteger(ref) && ref >= 0 && ref < orderIds.length)
      ) {
        errors.push(
          `${where}: order_ref must be null or an index below ${orderIds.length}`,
        );
      }
    });
    if (
      !subtasks.some((s) => isObject(s) && s.specialist === classifiedRoute)
    ) {
      errors.push(
        `plan: classified route "${classifiedRoute}" is not the specialist of any subtask`,
      );
    }
  }

  if (!Array.isArray(unrouted)) {
    errors.push("plan: unrouted must be an array");
  } else {
    unrouted.forEach((u, i) => {
      const where = `unrouted[${i}]`;
      if (!isObject(u)) {
        errors.push(`${where}: must be an object`);
        return;
      }
      unknownKeys(u, UNROUTED_KEYS, where, errors);
      if (!UNROUTED_LABELS.includes(u.label)) {
        errors.push(`${where}: unknown label "${u.label}"`);
      }
      checkSpan(u.text, message, where, "text", errors);
    });
  }

  return { ok: errors.length === 0, errors };
}
