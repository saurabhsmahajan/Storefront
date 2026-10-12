   # Jobs to Be Done and RICE for the support agent (2026-10-12)

   ## Jobs to Be Done

   Primary job (the customer):

   > When I have paid for something and it is not going as expected (no sign of
   > the order, a failed payment, or I want my money back), I want a correct
   > answer about my own order, or a quick route to a person who can fix it, so
   > that I can stop worrying about my money without chasing anyone.

   Secondary job (the support team):

   > When support volume grows, I want routine order, payment and refund
   > questions answered correctly, and the cases that need judgement passed on
   > with the facts already gathered, so that human agents spend their time on
   > decisions and nobody has to ask the customer the same thing twice.

   What the agent is not hired to do (constraints that came from the evidence):
   - Move money. Every refund is decided by a human. The handoff package always
     says nothing is approved.
   - Explain fraud screening or name which card field failed. The decline
     disclosure rule is enforced in code (evidence/decline-disclosure-decision-2026-10-06.md).
   - Guess. When it cannot see a fact it says so, or hands the case on.

   How the three specialists serve the jobs:

   | Specialist | Customer's question | Job served |
   |---|---|---|
   | Order Status | "Where is my order? Did it go through?" | A correct answer about my own order |
   | Decline Explainer | "Why did my payment fail?" | A correct answer, then something I can act on |
   | Refund Eligibility | "Can I get my money back?" | A correct answer, or a route to a person who decides |

   Evidence that the jobs are met (full system, evidence/system-scores-2026-10-06.md):
   16 of 21 correct, 0 invented, escalation right on 21 of 21, a handoff package
   on every escalation. The unmet part of the primary job is "where is it": no
   specialist can see shipping or tracking.

   ## RICE

   RICE = Reach x Impact x Confidence / Effort. Storefront has no real traffic, so
   the inputs below are stated assumptions. They are not measurements.

   | Specialist | Reach (contacts per quarter) | Impact | Confidence | Effort (person-days) | RICE |
   |---|---|---|---|---|---|
   | Order Status | 3500 | 0.5 | 50% | 1 | 875 |
   | Decline Explainer | 1500 | 1 | 80% | 2 | 600 |
   | Refund Eligibility | 2500 | 2 | 80% | 4 | 1000 |

   Ranking by RICE: 1. Refund Eligibility, 2. Order Status, 3. Decline Explainer.

   Basis for each input:
   - Reach: an assumed 10000 contacts per quarter, split 35% order status, 15%
     payment declines, 25% refunds and returns, 25% not covered. The split is an
     assumption to be replaced by real ticket data.
   - Impact (RICE scale: 3 massive, 2 high, 1 medium, 0.5 low, 0.25 minimal), per
     contact. Order Status 0.5: it can only give status, total and date, and not
     the shipping or tracking that "where is it" asks for (every reply says so).
     Decline Explainer 1: it turns a failed payment into an explanation the
     customer can act on. Refund Eligibility 2: it decides eligibility with
     tested code, resolves the clear no cases without a human, and hands the rest
     over with the facts gathered.
   - Confidence is set from the measured results, because reach and impact are
     assumptions: Order Status 50% (3 of its 6 messages correct in the full
     system run), Decline Explainer 80% (4 of 4 on the revised expectations),
     Refund Eligibility 80% (4 of 4, plus the policy-gap case #17, with 13 unit
     tests on the rules). This departs from RICE's usual meaning of confidence
     (how sure the estimates are), and it is stated here on purpose.
   - Effort: rough person-days as built, estimated after the fact. Order Status 1
     (one tool, one prompt), Decline Explainer 2 (the disclosure mapping and its
     decision), Refund Eligibility 4 (the rules, 13 tests, the facts for the
     handoff, and the prompt changes).

   ## Does RICE justify the build order? No.

   Build order: 1. Decline Explainer, 2. Order Status, 3. Refund Eligibility.
   RICE order: 1. Refund Eligibility, 2. Order Status, 3. Decline Explainer. Two of
   the three positions disagree, and the first and last are exactly reversed.

   The build order was driven by criteria RICE does not capture. This is recorded
   after the fact, not planned in advance:
   - Decline Explainer first: the disclosure decision (what a customer may be told
     about a decline) was the one failure every earlier layer left open, and it had
     to be settled in code before any specialist was written.
   - Order Status second: the smallest loop, which proved the tool allowlist and the
     scoped credential on the lowest-risk data.
   - Refund Eligibility last: the highest risk and the largest dependency. It needed
     the handoff package and the tested eligibility rules, and it benefits most from
     the guarantees (step cap, fallback, escalation) being proven first.

   That is a risk-and-dependency ordering. It is a defensible reason to build the
   riskiest specialist last. It is not a RICE result, and this file does not claim
   it is.

   ## Sensitivity (how much the ranking depends on the inputs)

   | Change to one input | New ranking |
   |---|---|
   | Order Status impact 0.5 to 1.5 (shipping and tracking data added) | Order Status (2625), Refund (1000), Decline (600) |
   | Order Status confidence 50% to 80% | Order Status (1400), Refund (1000), Decline (600) |
   | Order Status reach 3500 to 1500 | Refund (1000), Decline (600), Order Status (375) |
   | Refund impact 2 to 1 | Order Status (875), Decline (600), Refund (500) |
   | Refund effort 4 to 8 | Order Status (875), Decline (600), Refund (500) |
   | Decline reach 1500 to 3000 | Decline (1200), Refund (1000), Order Status (875) |

   The ranking changes with any single reasonable change, so it should not be read
   as precise. The one finding that holds in every row: Order Status is only as
   valuable as the data it can see. Giving it shipping and tracking data is the
   change that moves it from second to first by a wide margin, and it is a data
   change, not another specialist.

   ## Limits

   - No real traffic: reach and the contact mix are assumed.
   - Impact scores are judgements.
   - Confidence uses measured scores as a proxy (see above).
   - Effort is estimated after the fact and is rough. Only the ranking among the
     three matters, and it is consistent across them.
   - The 21-message test set is not a sample of real traffic.
   - The scores were computed by script, with the inputs fixed before the ranking
     was read.