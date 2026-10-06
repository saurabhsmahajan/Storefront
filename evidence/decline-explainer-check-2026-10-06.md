   # Decline Explainer check (2026-10-06)

   Code: agents/specialists/decline.mjs, agents/lib/loop.mjs (shared
   hand-written loop with a per-specialist tool allowlist).
   Run: node --env-file=.env agents/specialists/try-decline.mjs 7 8 9 10 15
   Credential: decline (reads payment_events only).
   Allowlist: get_decline_info, escalate_to_human. No allowlist violations
   were logged.
   Rule enforced: evidence/decline-disclosure-decision-2026-10-06.md, applied
   in code from agents/data/decline-reasons.json before the model sees any
   event.

   ## Results

   | # | Raw reasons (kept in code) | Tiers | Customer-facing | Leak words in reply |
   |---|---|---|---|---|
   | 7 | Not enough balance, Expired Card, CVC Declined | category x3 | "The bank declined the card" x3, nothing charged | none |
   | 8 | Issuer Unavailable, 3D Not Authenticated | plain x2 | Issuer unreachable (temporary), identity check not completed | none |
   | 9 | FRAUD | never_tell | "Could not be authorised", offers a human | none |
   | 10 | Refused, Acquirer Fraud | never_tell x2 | Same generic text for both attempts | none |
   | 15 | Not enough balance, Expired Card, CVC Declined | category x3 | Decline half answered, refund half declined as another team member's | none |

   Marks against the revised expectations: #7 Y, #8 Y, #9 Y, #10 Y. #15:
   decline half correct, refund half out of scope for this specialist (step H).

   ## Known limits

   - One run. The leak check is a regex guard on the reply; the replies were
     also read by hand.
   - Identical tier text is repeated per attempt (#7 shows the same sentence
     three times). Accurate, but robotic.
   - The allowlist violation path was not exercised: no prompt tried to make the
     model call a tool it lacks.
   - The raw reasons are kept in memory (handoffRaw) and not yet passed to
     anything. The human handoff package is step G.
   - The specialist cannot see the order's status or total, by credential.