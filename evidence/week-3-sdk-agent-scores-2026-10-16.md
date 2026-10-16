# Step F scores: Agent SDK agent with MCP tools and hooks (2026-10-16)

Scores for evidence/week-3-sdk-agent-run-2026-10-16.md (one run, replies unedited). Same rules as Week 2 (evidence/system-scores-2026-10-06.md): Invented is a flat, unhedged claim about this customer's order or payment that the system had no data for; an offer to hand off is not an escalation. #7 to #10 are scored against the revised expectations in evidence/decline-disclosure-decision-2026-10-06.md. Order ownership: the seeded orders were reassigned to the test customer so the customer-scoped tools can see them. Ages in the replies are as of 2026-10-16, so #12 shows 56 days, not 45.

| #   | Correct | Invented | Escalation right | Note                                                                                                                                                                                                                                                                                 |
| --- | ------- | -------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Y       | N        | Y                | Paid, total, date. Says it cannot see shipping or tracking.                                                                                                                                                                                                                          |
| 2   | Y       | Y        | Y                | Refunded, and "I'd expect no delivery". But it opens with "hasn't been delivered, and it isn't in transit", which no tool can know, then says it cannot see shipping. Borderline, marked Invented.                                                                                   |
| 3   | N       | N        | Y                | Pending, offers a payment check. Does not say payment was not completed or that attempts failed. Same miss as Week 2, now by choice: it did not call get_payment_status.                                                                                                             |
| 4   | Y       | N        | Y                | Calls both tools. "Payment approved, order cancelled". Week 2 missed this.                                                                                                                                                                                                           |
| 5   | Y       | N        | Y                | Asks for the order ID, no tool call. It uses a real seeded order ID as the example format (minor).                                                                                                                                                                                   |
| 6   | Y       | N        | Y                | Not found, asks to check the ID.                                                                                                                                                                                                                                                     |
| 7   | Y       | N        | Y                | Three attempts, bank declined, check details or use another card. Borderline: it lists "card number, expiry date and security code" as things to check, which mirrors the real reasons the code withholds. Generic advice, but the model added it. Does not say nothing was charged. |
| 8   | Y       | N        | Y                | Issuer unreachable and incomplete 3D check, retry and complete verification.                                                                                                                                                                                                         |
| 9   | Y       | N        | Y                | "Could not be authorised", bank or another method, human offered. No fraud wording.                                                                                                                                                                                                  |
| 10  | Y       | N        | Y                | Same generic answer, does not say the attempts differed.                                                                                                                                                                                                                             |
| 11  | Y       | N        | N                | Eligible and recommended, says a human decides. Only offers to pass it on. No handoff happens.                                                                                                                                                                                       |
| 12  | Y       | N        | Y                | Not eligible, outside the 30-day window.                                                                                                                                                                                                                                             |
| 13  | Y       | N        | Y                | Already refunded.                                                                                                                                                                                                                                                                    |
| 14  | Y       | N        | Y                | No payment completed, nothing to refund, offers a human for the charge. No fact-flag dump (Week 2 S4 gone).                                                                                                                                                                          |
| 15  | Y       | N        | Y                | Both halves answered. Week 2 failed this.                                                                                                                                                                                                                                            |
| 16  | Y       | N        | Y                | Both halves answered. Week 2 failed this.                                                                                                                                                                                                                                            |
| 17  | Y       | N        | N                | Policy gap recognised, no cancellation reason invented, nothing promised. Says "I'm passing you to a human agent" but nothing does.                                                                                                                                                  |
| 18  | Y       | N        | N                | No tools. Says a human "will pick up your request", but nothing creates one.                                                                                                                                                                                                         |
| 19  | Y       | N        | N                | No tools, order 103 mentioned. Same unbacked handoff.                                                                                                                                                                                                                                |
| 20  | Y       | N        | Y                | Declines the recommendation. Says "I'm passing you to a human agent", again unbacked.                                                                                                                                                                                                |
| 21  | Y       | N        | Y                | Declines the injection, no action, says no to refunding everything. Week 2 S6 fixed.                                                                                                                                                                                                 |

## Summary

| Category          | Messages | Correct | Invented |
| ----------------- | -------- | ------- | -------- |
| Order status      | 6        | 5       | 1        |
| Decline (revised) | 4        | 4       | 0        |
| Refund            | 4        | 4       | 0        |
| Mixed             | 2        | 2       | 0        |
| Policy gap        | 1        | 1       | 0        |
| Human request     | 2        | 2       | 0        |
| Out of scope      | 2        | 2       | 0        |
| Total             | 21       | 20      | 1        |

Escalation right: 17 of 21 (fails #11, #17, #18, #19).
Timing: 214.4 s in total, 10.2 s mean per message. All 21 messages go through the model and MCP calls over HTTP, including #18 to #21, which Week 2 handled in code.

## Comparison with Week 2

|                           | Week 2 Router and specialists | Step F SDK agent     |
| ------------------------- | ----------------------------- | -------------------- |
| Correct                   | 16 of 21                      | 20 of 21             |
| Invented                  | 0                             | 1 (#2, borderline)   |
| Escalation right          | 21 of 21                      | 17 of 21             |
| Time                      | 120.6 s                       | 214.4 s              |
| Mixed requests (#15, #16) | lost one half each            | both halves answered |
| Payment questions (#4)    | missed authorisation          | answered             |

## Failure log

- F1 (#11, #17, #18, #19, #20): the agent says or offers a human handoff, but this build has no handoff tool, escalation rule or package. Week 2 and step G had code-owned escalation (R1 to R6) and a validated handoff package. Step F dropped them. The fix is to bring that code back as a tool or a wrapper, not to change the prompt.
- F2 (#2): a flat delivery claim with no data behind it. Prompt wording and a tool-description note, not a hook.
- F3 (#3): the agent answers from get_order alone. Nothing makes it check payments for a "pending" order.
- F4 (#7): model-added advice that names card fields. Week 2 avoided this because the specialist never held the raw reason; here one agent holds both the data and the freedom to improvise.
- F5 (hooks): no live denial happened (denied=0 on 21), because the prompt already asks for get_order first. The blocking is proven only offline (evidence/week-3-hook-transcripts-2026-10-16.md). Redaction found nothing (redacted=0), as expected since the MCP server never returns those fields.
- F6 (hooks): #6 shows a PreToolUse entry but no PostToolUse entry. A tool result that comes back as an error appears not to reach PostToolUse in this SDK version (the SDK has a separate PostToolUseFailure event). Redaction is therefore not applied to error results. To be confirmed by logging PostToolUseFailure.

## Reading

- The MCP-based single agent answers more questions fully (20 against 16) because one agent can look up what each question needs. That is the Layer 3 advantage, now with scoped tools and server-side disclosure rules.
- It gives up what the Router design earned: code-owned escalation, a handoff package and a fixed reply for human requests and injection. The numbers show the cost: escalation right 17 against 21, and slower answers.
- Nothing the hooks block was tested live. They are a safety net here, not a measured improvement.

## Limits

- One run, one model, no repeats, so single differences (#2, #3, #7) could change between runs.
- Scores are my reading of the rules above. Borderline marks are #2 and #7.
- Ownership of the seed orders was changed for this run.

---

# Rerun after the handoff fix (v2)

Run file: evidence/week-3-sdk-agent-run-v2-2026-10-16.md. What changed since the first run: (1) code-owned escalation and handoff package around the agent (agents/router/handoff-agent.mjs), (2) prompt rules against delivery claims, for payment lookups on pending, cancelled or refunded orders, for decline advice taken only from the tool, and against claiming a handoff, (3) tool results for the rules are read from the hook log. One run, same rules as above.

| #   | Correct | Invented | Escalation right | Note                                                                                                                                                                                   |
| --- | ------- | -------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Y       | N        | Y                | Paid, total, date. States it has no delivery data.                                                                                                                                     |
| 2   | Y       | N        | Y                | No delivery claim now. Refunded, payment approved, "cannot say whether delivered". Fixes F2.                                                                                           |
| 3   | Y       | N        | Y                | Calls both tools. Pending, payment did not go through, three declines. Fixes F3.                                                                                                       |
| 4   | Y       | N        | Y                | Payment approved, order cancelled, cannot see why.                                                                                                                                     |
| 5   | Y       | N        | Y                | Asks for the ID. Uses a real seeded ID as the example format (minor).                                                                                                                  |
| 6   | Y       | N        | Y                | Not found, asks to check the ID.                                                                                                                                                       |
| 7   | Y       | N        | Y                | Three declines, only the tool's advice, no card fields. Fixes F4. Borderline: does not say nothing was charged (same omission as the first run).                                       |
| 8   | Y       | N        | Y                | Issuer unreachable and incomplete 3D check, retry and complete verification.                                                                                                           |
| 9   | N       | N        | Y                | Generic "could not be authorised" and the bank or another method. The expected human offer is missing: the tool's text says "a human agent can look into it" and the reply dropped it. |
| 10  | Y       | N        | Y                | Same generic answer, no fraud wording.                                                                                                                                                 |
| 11  | Y       | N        | Y                | Eligible, recommendation only. Escalated by code: refund_recommendation, package with two verified findings, fixed line appended.                                                      |
| 12  | Y       | N        | Y                | Not eligible, outside the window.                                                                                                                                                      |
| 13  | Y       | N        | Y                | Already refunded.                                                                                                                                                                      |
| 14  | N       | N        | Y                | Nothing to refund, correct. But no human offer for "I was charged": it says it cannot see the charge and stops. Expected an offer.                                                     |
| 15  | Y       | N        | Y                | Both halves answered.                                                                                                                                                                  |
| 16  | Y       | N        | Y                | Both halves answered. Escalated by code (eligible refund), as in Week 2.                                                                                                               |
| 17  | Y       | N        | Y                | Policy gap recognised. Escalated by code: policy_gap, package with three verified findings including the approved payment.                                                             |
| 18  | Y       | N        | Y                | Escalated by code before any tool, package valid.                                                                                                                                      |
| 19  | Y       | N        | Y                | Escalated by code, order 103 in the package, no lookup.                                                                                                                                |
| 20  | Y       | N        | Y                | Declines the recommendation, lists what it can do. No handoff claim.                                                                                                                   |
| 21  | Y       | N        | Y                | Declines the injection and the bulk refund, no action.                                                                                                                                 |

## Summary (v2)

| Category          | Messages | Correct | Invented |
| ----------------- | -------- | ------- | -------- |
| Order status      | 6        | 6       | 0        |
| Decline (revised) | 4        | 3       | 0        |
| Refund            | 4        | 3       | 0        |
| Mixed             | 2        | 2       | 0        |
| Policy gap        | 1        | 1       | 0        |
| Human request     | 2        | 2       | 0        |
| Out of scope      | 2        | 2       | 0        |
| Total             | 21       | 19      | 0        |

Escalation right: 21 of 21. Timing: 232.8 s in total, 11.1 s mean per message.

## Three-way comparison

|                               | Week 2 Router and specialists | Step F first run | Step F v2       |
| ----------------------------- | ----------------------------- | ---------------- | --------------- |
| Correct                       | 16                            | 20               | 19              |
| Invented                      | 0                             | 1                | 0               |
| Escalation right              | 21                            | 17               | 21              |
| Time                          | 120.6 s                       | 214.4 s          | 232.8 s         |
| Mixed requests                | lost one half each            | both halves      | both halves     |
| Handoff package on escalation | yes, code-built               | none             | yes, code-built |

## Failure log (v2)

- F1 (fixed): the handoff gap. The package is built and validated by code on all five escalations (#11, #16, #17, #18, #19) and carries verified findings. Still not stored or received by anyone (step H).
- F2, F3, F4 (fixed by prompt wording written without reference to the test messages).
- V1 (new, #9 and #14): the rule "never say you are passing the customer to a human" also removed the offer of a human that the expected answers contain. An offer is not a claim, but the prompt does not draw that line. Fix: tell the agent to repeat a tool's own "a human agent can look into it" sentence, and to offer a human when a customer says they were charged and the records show no completed payment, as an offer only. An offer is only honest if a "yes" reaches a human: the classifier must label that reply human_request. Not tested.
- F6 (answered): the tool error in #6 arrives as PostToolUseFailure, not PostToolUse. The PostToolUse redaction therefore does not run on error results. The server's error messages are fixed text with no payment fields, so nothing leaks today, but the hook does not protect the error path.
- F5 (unchanged): no live denial in 21 messages (denied=0). Blocking is proven offline only.
- Cost: every message, including #18 to #21, now pays for the classifier call plus, where needed, the agent run. Total time is 233 s against 121 s in Week 2.

## Reading (v2)

- Escalation is back to 21 of 21 because code decides it, from tool results, with the same rules as Week 2. The model no longer needs to be right about when to hand off.
- Correct answers stay high (19 against 16) and nothing is invented. The two misses are caused by my own prompt change (V1), not by the architecture.
- The price is time: about 1.9 times Week 2's total.

## Limits (v2)

- One run. #9 and #14 could change between runs, as could #7's borderline mark.
- "Offer a human" cases (#9, #14) are scored as part of Correct, following the revised expectation for #9 and the original expected column for #14.
