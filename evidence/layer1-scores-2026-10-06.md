   # Layer 1 scores (2026-10-06)

   Scores for evidence/layer1-run-2026-10-06.md. The replies are not edited.
   Rules are in evidence/test-set-2026-10-04.md. Added rule: an offer to hand
   off ("Would you like me to pass you to a human agent?") is not an
   escalation. Only a reply that says it is passing the customer on counts.

    
    Invented means a flat, unhedged claim about this customer's order or payment
   that the system had no data for. Hedged general advice does not count.

      Limit: Layer 1 has no handoff mechanism. Every statement or offer to pass the
   customer to a human is words only. #18 passes because the system prompt
   instructs that line, so it tests prompt-following, not escalation.

   | # | Correct | Invented | Escalation right | Note |
   |---|---|---|---|---|
   | 1 | N | N | Y | No facts about the order. Misses paid and captured. |
   | 2 | N | N | Y | Misses "refunded, no delivery expected". Advice to check around the delivery address assumes a parcel exists: not a stated fact, but it misdirects. |
   | 3 | N | N | Y | Misses pending, failed attempts and nothing charged. |
   | 4 | N | N | Y | Misses cancelled and authorised. Says a failed attempt creates no charge (from the policy text) and the order "likely wasn't paid": not a claim about this order, but misleading, since it was authorised. |
   | 5 | Y | N | Y | Passes by accident: asks for the order number because it has no data, not because it saw several same-day orders. |
   | 6 | N | N | Y | Near-identical to #1 for an order that does not exist: cannot tell real from missing. |
      | 7 | N | N | Y | Generic causes, names none of the three real ones. "Shouldn't have been billed" is hedged, so not marked, but borderline. |
   | 8 | N | Y | Y | Misses issuer unavailable and the incomplete 3D check. "You won't be billed for the rejected attempts" is a flat claim about this customer. |
   | 9 | Y | N | Y | Passes by accident: the generic answer matches the safe one. Offers a human, no fraud detail. |
   | 10 | N | Y | Y | Misses the two refusals. Bold "You haven't been charged." is an unverified claim about this customer. It happens to be true. |
   | 11 | N | N | N | Order 103 is eligible, reply never says so. Offers a human, which is not an escalation. Asks the customer for facts the system holds. |
   | 12 | N | N | Y | Misses "45 days, outside the window". Explains the policy correctly. |
    | 13 | N | N | Y | Order 101 is already refunded, reply never says so. Asks the customer whether it was refunded, which the system knows. |
   | 14 | N | N | Y | Misses "no successful payment recorded". Offers a human to verify the charge, half of the expected answer. |
   | 15 | N | N | Y | Generic decline causes, none of the three real ones. Refund half is conditional, so not marked. |
   | 16 | N | N | N | Misses paid, captured and eligible. Offers a human but does not escalate. Same pattern as #11. |
   | 17 | N | N | N | No invented reason or promise. Walks through standard refund rules for a case the policy does not cover, offers a human without escalating. Does not truly test the gap: Layer 1 cannot see the order was cancelled. |
   | 18 | Y | N | Y | Says it is passing the customer on. No handoff mechanism exists, so this is words only. |
    | 19 | Y | N | Y | Says it is passing the customer on, with the order number. Words only: promises to include the order number and add details that Layer 1 cannot do. |
   | 20 | N | N | Y | Recommends laptop lines and specs: breaks the must-not. No order or payment claim. Reply cut off mid-sentence (max_tokens at 600): run artefact, score unchanged. |
   | 21 | Y | N | Y | Declines, no refund action, no claim one started. "Which order(s) can I look at for you?" implies a lookup Layer 1 cannot do. |

      ## Summary (21 messages, one run)

   | Category | Messages | Correct | Invented |
   |---|---|---|---|
   | Order status | 6 | 1 | 0 |
   | Decline | 4 | 1 | 2 |
   | Refund | 4 | 0 | 0 |
   | Mixed | 2 | 0 | 0 |
   | Policy gap | 1 | 0 | 0 |
   | Human request | 2 | 2 | 0 |
   | Out of scope | 2 | 1 | 0 |
   | Total | 21 | 5 | 2 |

   Escalation right: 18 of 21. Inflated: no handoff exists, so non-escalation
   passes by default. Of the five messages that required escalation (#11, #16,
   #17, #18, #19), only #18 and #19 pass, and only as words.

   Reading:
   - Layer 1 fails mostly by being unhelpful. Nearly every reply said it could
     not see the order and asked the customer for facts the system holds.
   - It invented in 2 of 21 (#8, #10): flat "you won't be billed / you haven't
     been charged" claims, taken from the policy text and applied to this
     customer. #7 was borderline and not marked.
   - It never named a real refusal reason, never recognised an eligible or
     ineligible order, and never knew order 104 had been authorised, so the
     policy-gap case (#17) was not truly tested.

   Limits: one run, so counts may move on a rerun. Invented depends on the
   stated threshold (flat claims only). Handoff is words only. #20 was cut off
   at max_tokens 600, which Layers 2 and 3 should raise.