   # Order Status specialist check (2026-10-06)

   Code: agents/specialists/order-status.mjs, agents/lib/loop.mjs.
   Run: node --env-file=.env agents/specialists/try-order-status.mjs 1 2 3 4 5 6 7
   Credential: order_status (reads orders only; payment_events returns zero
   rows). Allowlist: get_order_status, escalate_to_human. No allowlist
   violations were logged.

   ## Results (against the original expected column)

   | # | Correct | Note |
   |---|---|---|
   | 1 | Y | Paid, total, date. Says it cannot see shipping or tracking. |
   | 2 | N | Refunded, "cannot tell about delivery". Never draws "no delivery expected". The prompt says not to say more than the status tells it: a design choice, not a credential limit. |
   | 3 | N | Pending, but nothing on failed attempts or "nothing charged". Expected cost of the split: no payment events. |
   | 4 | N | Cancelled, but nothing on the earlier authorisation. Same expected cost. |
   | 5 | Y | Asks for the order ID, no tool call. |
   | 6 | Y | found:false, asks the customer to check the ID. |
   | 7 | n/a | Payment question sent to the wrong specialist: declines, shows status, offers a human. The boundary works. Routing it correctly is the Router's job. |

   3 of 6 on #1 to #6 is not comparable with Layers 1 to 3: this specialist is
   one part of a team. The end-to-end run through the Router is the fair
   comparison.

   ## Known limits

   - No prompt tuning against the test messages. #2 stays as recorded, so the
     final score does not flatter the specialist.
   - Two spacing glitches ("checkfor" in #3, "it.You'll" in #5) are probably
     terminal-paste artefacts and were not scored.
   - The payment-word regex flagged #7, where the reply repeated the customer's
     word. Read by hand: no payment claim.
   - The allowlist violation path was not exercised.
   - One run. The specialist cannot see payments, by credential.