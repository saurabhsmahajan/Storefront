   # Router comparison: classifier vs agentic (2026-10-06)

   Answer key: evidence/router-expected-routes-2026-10-06.md, written before
   either Router was built. Acceptable routes per message (two for the mixed
   requests #15 and #16).
   Code: agents/router/classifier-router.mjs (one model call, one label, no
   tools), agents/router/agentic-router.mjs (shared loop, one tool route_to
   that records the choice, no data, no credential).
   Runs: node --env-file=.env agents/router/test-classifier-router.mjs and
   test-agentic-router.mjs.

   ## Result

   | | Correct | Model calls | Total time | Per message |
   |---|---|---|---|---|
   | Classifier Router | 21 of 21 | 21 | 32.9 s | 1.6 s |
   | Agentic Router | 21 of 21 | 42 | 73.5 s | 3.5 s |

   The two Routers chose the same route on all 21 messages. #15 went to decline
   and #16 to refund in both: one acceptable route of two, so half of each mixed
   request is dropped until step H splits them.
   The agentic Router never asked a clarifying question and never failed. Every
   message took exactly two calls: the routing call, then the call after the
   tool result.

   ## Decision

   Use the classifier Router for the end-to-end run: equal accuracy, half the
   model calls, less than half the time, fewer ways to fail. Reopen this only if
   step H shows a Router has to decompose mixed requests.

   ## Known limits

   - One run each. This model's temperature cannot be fixed, so labels on
     borderline messages can vary between runs.
   - The test set has no message that needs a clarifying question, and the
     agentic prompt tells the Router not to ask about a missing order number.
     The result therefore shows no benefit on this test set, not that an agent
     can never help a Router.
   - Tokens and cost in money were not measured, only calls and time. Times
     include network variation.
   - Both Routers send a mixed request to one specialist. Answer-key
     acceptance of either route hides that half of the request is dropped.