// Human approvals for the stub execute_refund tool. The hook asks has(orderId).
// An approval is made only by the review screen, expires after ttlMs and is used once.
// Stored in a JSON file so the review server and the agent process can both see it.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const sha256 = (value) =>
  crypto.createHash("sha256").update(stable(value)).digest("hex");

// JSON with sorted keys, so the same data always gives the same digest.
export function stable(v) {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(v[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v) ?? "null";
}

export function createApprovalStore({
  file,
  ttlMs = 30 * 60 * 1000,
  now = () => new Date(),
} = {}) {
  if (!file) throw new Error("createApprovalStore needs a file");
  const read = () => {
    try {
      return JSON.parse(fs.readFileSync(file, "utf8")).approvals ?? [];
    } catch {
      return [];
    }
  };
  const write = (approvals) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ approvals }, null, 1));
  };
  const live = (a) =>
    !a.consumed && new Date(a.expires_at).getTime() > now().getTime();
  return {
    add({ orderId, approvedBy, packageSha256, viewDigest }) {
      const rec = {
        order_id: String(orderId).toLowerCase(),
        approved_by: approvedBy,
        approved_at: now().toISOString(),
        expires_at: new Date(now().getTime() + ttlMs).toISOString(),
        package_sha256: packageSha256,
        view_digest: viewDigest,
        consumed: false,
      };
      write([...read(), rec]);
      return rec;
    },
    has(orderId) {
      const id = String(orderId).toLowerCase();
      return read().some((a) => a.order_id === id && live(a));
    },
    // Marks the newest live approval for the order as used. Returns true if one was.
    consume(orderId) {
      const id = String(orderId).toLowerCase();
      const all = read();
      const i = all.findLastIndex((a) => a.order_id === id && live(a));
      if (i < 0) return false;
      all[i] = { ...all[i], consumed: true, consumed_at: now().toISOString() };
      write(all);
      return true;
    },
    list: read,
  };
}
