// Local review server: node agents/review/server.mjs
// Env: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, REVIEWER_EMAIL, REVIEWER_PASSWORD
// Packages are read from agents/review/inbox/*.json. Approvals go to agents/review/approvals.json.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { createApprovalStore } from "./approvals.mjs";
import { buildView, confirmApproval } from "./review-core.mjs";
import { renderInbox, renderMessage, renderReview } from "./page.mjs";
import { staffSource } from "./staff-data.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
export const INBOX = path.join(here, "inbox");
export const APPROVALS_FILE = path.join(here, "approvals.json");
const NAME = /^[A-Za-z0-9._-]+\.json$/;

export function createServer({
  source,
  store,
  inbox = INBOX,
  token = crypto.randomBytes(16).toString("hex"),
}) {
  const loadPkg = (name) => {
    if (!NAME.test(name)) return null;
    try {
      return JSON.parse(fs.readFileSync(path.join(inbox, name), "utf8"));
    } catch {
      return null;
    }
  };
  const send = (res, code, html) => {
    res.writeHead(code, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "content-security-policy":
        "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; form-action 'self'",
    });
    res.end(html);
  };
  const body = (req) =>
    new Promise((resolve) => {
      let s = "";
      req.on("data", (c) => (s += c.length < 20000 ? c : ""));
      req.on("end", () => resolve(new URLSearchParams(s)));
    });
  return http.createServer(async (req, res) => {
    try {
      // Only this machine, only by its own name (blocks DNS rebinding).
      const host = String(req.headers.host ?? "").split(":")[0];
      if (host !== "127.0.0.1" && host !== "localhost")
        return send(
          res,
          403,
          renderMessage("Forbidden", "Use http://127.0.0.1."),
        );
      const url = new URL(req.url, "http://127.0.0.1");
      if (req.method === "GET" && url.pathname === "/") {
        const names = fs.existsSync(inbox)
          ? fs
              .readdirSync(inbox)
              .filter((n) => NAME.test(n))
              .sort()
          : [];
        return send(res, 200, renderInbox(names));
      }
      const m = url.pathname.match(/^\/p\/([^/]+?)(\/confirm)?$/);
      if (!m)
        return send(res, 404, renderMessage("Not found", "No such page."));
      const name = decodeURIComponent(m[1]);
      const pkg = loadPkg(name);
      if (!pkg)
        return send(res, 404, renderMessage("Not found", "No such package."));
      if (req.method === "GET" && !m[2]) {
        const view = await buildView(pkg, source);
        return send(
          res,
          200,
          renderReview({
            view,
            name,
            token,
            existing: Boolean(pkg.order_id && store.has(pkg.order_id)),
          }),
        );
      }
      if (req.method === "POST" && m[2]) {
        const origin = req.headers.origin;
        if (
          origin &&
          !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)
        )
          return send(res, 403, renderMessage("Forbidden", "Bad origin."));
        const form = await body(req);
        if (form.get("token") !== token)
          return send(
            res,
            403,
            renderMessage("Forbidden", "Bad token. Reload the page."),
          );
        const r = await confirmApproval({
          pkg,
          source,
          store,
          viewDigest: form.get("digest"),
          acknowledged: form.get("ack") === "yes",
        });
        if (!r.ok)
          return send(
            res,
            r.code === "stale" ? 409 : 400,
            renderMessage("Not approved", r.message),
          );
        const view = await buildView(pkg, source);
        return send(
          res,
          200,
          renderReview({ view, name, token, approvedNow: r.approval }),
        );
      }
      return send(
        res,
        405,
        renderMessage("Not allowed", "Method not allowed."),
      );
    } catch (err) {
      return send(res, 500, renderMessage("Error", err.message));
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const source = await staffSource();
  const store = createApprovalStore({ file: APPROVALS_FILE });
  const port = Number(process.env.REVIEW_PORT ?? 4173);
  createServer({ source, store }).listen(port, "127.0.0.1", () =>
    console.log(
      `Review screen: http://127.0.0.1:${port}/  (reviewer: ${source.reviewerEmail})`,
    ),
  );
}
