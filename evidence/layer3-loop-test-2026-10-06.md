   # Layer 3 loop test (2026-10-06)

   Code: agents/layer3/agent.mjs (hand-written loop, bounded `for`, default cap
   6 steps). Test: agents/layer3/loop-test.mjs.
   Run: node --env-file=.env agents/layer3/loop-test.mjs

   Guarantee under test: every session ends in "resolved" or "escalated". The
   cap, an API error, an empty final reply and an unexpected stop reason all
   force an escalation from code.

   ## Case A: cap = 1 (deterministic)

   Message: "Where is my order 5eed0000-0000-4000-8000-000000000103?"
   Step 1: stop_reason tool_use (get_order, get_payment_events). Cap reached.
   Outcome: escalated, forced by code, reason "step_cap".
   Reply: "I'm passing you to a human agent who can help you from here."

   ## Case B: lookup that never finishes, cap = 4

   Stub tool result on every call: found false, "Lookup still processing. Call
   the same tool again with the same order_id."
   Steps 1 to 3: tool_use, get_order and get_payment_events each step.
   Step 4: tool_use, get_order. Cap reached.
   Outcome: escalated, forced by code, reason "step_cap".
   The model never gave up: it repeated the same calls with the same input
   until the cap stopped it.

   ## Known limits

   - Case A is true by construction: a cap of 1 on a message that needs a tool
     call tests the code path, not the model.
   - The stubbed tool is not a real timeout or error. Real failures are step I.
   - Only the cap stopped the repeats. There is no duplicate-call detection.
   - The fallback reply is generic and carries no handoff package. Step G.
   - One run each. Model behaviour in Case B may differ on a rerun.