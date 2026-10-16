// HTML for the review screen. Everything that came from a customer, a model or a
// payment provider is escaped: none of it is trusted.
export const esc = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const json = (v) => esc(JSON.stringify(v, null, 2));

const CSS = `
:root{--bg:#fff;--fg:#1b1f24;--mut:#59636e;--line:#d0d7de;--card:#f6f8fa;--warn:#fff8c5;--ok:#dafbe1;--bad:#ffebe9}
@media(prefers-color-scheme:dark){:root{--bg:#0d1117;--fg:#e6edf3;--mut:#9198a1;--line:#30363d;--card:#161b22;--warn:#3a2f00;--ok:#0f2f1a;--bad:#3d1214}}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif}
main{max-width:1200px;margin:0 auto;padding:16px}
h1{font-size:20px;margin:0 0 4px}h2{font-size:16px;margin:0 0 8px}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:800px){.cols{grid-template-columns:1fr}}
.card{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px;margin-bottom:12px}
.tag{display:inline-block;font-size:12px;border:1px solid var(--line);border-radius:999px;padding:0 8px;margin-left:6px}
.warn{background:var(--warn)}.ok{background:var(--ok)}.bad{background:var(--bad)}
pre{white-space:pre-wrap;word-break:break-word;margin:0;font:12px/1.4 ui-monospace,monospace}
table{width:100%;border-collapse:collapse;font-size:13px}td,th{border-top:1px solid var(--line);padding:4px 6px;text-align:left;vertical-align:top}
.mut{color:var(--mut)}button{font:inherit;padding:8px 14px;border-radius:6px;border:1px solid var(--line);background:var(--fg);color:var(--bg);cursor:pointer}
button[disabled]{opacity:.4;cursor:not-allowed}label{display:block;margin:8px 0}
`;

const shell = (title, body) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${CSS}</style></head><body><main>${body}</main></body></html>`;

export function renderInbox(names) {
  const list = names.length
    ? `<ul>${names.map((n) => `<li><a href="/p/${encodeURIComponent(n)}">${esc(n)}</a></li>`).join("")}</ul>`
    : `<p class="mut">No handoff packages in the inbox.</p>`;
  return shell("Handoff inbox", `<h1>Handoff inbox</h1>${list}`);
}

export function renderMessage(title, text, kind = "bad") {
  return shell(
    title,
    `<h1>${esc(title)}</h1><div class="card ${kind}">${esc(text)}</div><p><a href="/">Back to inbox</a></p>`,
  );
}

export function renderReview({
  view,
  name,
  token,
  approvedNow = null,
  existing = false,
}) {
  if (!view.ok)
    return renderMessage("Invalid handoff package", view.errors.join("; "));
  const { pkg, order, events } = view;
  const findings = pkg.findings
    .map(
      (f) => `<tr><td>${esc(f.source)}</td><td><pre>${json(f)}</pre></td></tr>`,
    )
    .join("");
  const eventRows = events.length
    ? events
        .map(
          (e) =>
            `<tr><td>${esc(e.received_at ?? "")}</td><td>${esc(e.event_type ?? "")}</td><td><pre>${json(e.payload ?? e)}</pre></td></tr>`,
        )
        .join("")
    : `<tr><td colspan="3" class="mut">No payment events for this order.</td></tr>`;
  const banner = approvedNow
    ? `<div class="card ok"><strong>Approved</strong> by ${esc(approvedNow.approved_by)} until ${esc(approvedNow.expires_at)}. One execute_refund call may now run for this order.</div>`
    : existing
      ? `<div class="card ok">A live approval already exists for this order.</div>`
      : "";
  const blockers = view.blockers.length
    ? `<div class="card bad">${view.blockers.map(esc).join("<br>")}</div>`
    : "";
  const form =
    view.canApprove && !approvedNow
      ? `<form method="post" action="/p/${encodeURIComponent(name)}/confirm" class="card warn">
<input type="hidden" name="token" value="${esc(token)}"><input type="hidden" name="digest" value="${esc(view.digest)}">
<h2>Confirm</h2>
<p>You are signed in as <strong>${esc(view.reviewer)}</strong>. Approving does not move money. It lets one <code>execute_refund</code> call run for order <code>${esc(pkg.order_id)}</code> within 30 minutes. The refund itself is still a stub.</p>
<label><input type="checkbox" name="ack" value="yes" id="ack"> I have reviewed the raw order and payment records on the right and approve the recommendation.</label>
<button type="submit" id="go" disabled>Approve refund</button>
</form>
<script>document.getElementById('ack').addEventListener('change',function(e){document.getElementById('go').disabled=!e.target.checked})</script>`
      : "";
  return shell(
    `Review ${pkg.order_id ?? ""}`,
    `<h1>Review handoff <span class="tag">${esc(pkg.trigger)}</span></h1>
<p class="mut">Package created ${esc(pkg.created_at)}. Package digest ${esc(view.packageSha256.slice(0, 12))}. Records digest ${esc(view.digest.slice(0, 12))}.</p>
${banner}${blockers}
<div class="cols">
<section><h2>Agent side (mapped and redacted)</h2>
<div class="card"><strong>Recommendation</strong><p>${esc(pkg.recommendation ?? "None")}</p><p class="mut">Nothing is approved in the package: refund_approved = ${esc(pkg.authorization.refund_approved)}.</p></div>
<div class="card"><strong>Customer message</strong> <span class="tag">untrusted</span><p>${esc(pkg.customer_message)}</p></div>
<div class="card"><strong>Agent note</strong> <span class="tag">model text, unverified</span><pre>${esc(pkg.agent_note ?? "")}</pre></div>
<div class="card"><strong>Findings</strong> <span class="tag">from tool results</span><table>${findings || '<tr><td class="mut">None</td></tr>'}</table></div>
</section>
<section><h2>Raw records (your staff credentials)</h2>
<div class="card"><strong>Order</strong><pre>${order ? json(order) : "Not found"}</pre></div>
<div class="card"><strong>Payment events</strong> <span class="tag">${events.length}</span><table><tr><th>Received</th><th>Type</th><th>Payload</th></tr>${eventRows}</table></div>
</section></div>
${form}`,
  );
}
