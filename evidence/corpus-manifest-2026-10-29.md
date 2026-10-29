# Policy corpus manifest (2026-10-29)

Week 4, step B. The corpus is the test material for the ingestion pipeline (step E), the policy search (step G) and the golden sets. Source files are in `agents/data/policy/`. The Week 2 file `agents/data/refund-policy.txt` is kept unchanged because Week 2 and 3 code still reads it.

## Documents

| # | File | ID | Owner | Version | Effective date (as written) | Format |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 01-refund-eligibility.txt | POL-001 | Support Policy Owner | 1.0 | 2026-10-01 | Numbered prose |
| 2 | 02-return-windows.txt | POL-002 | Support Policy Owner | 1.0 | 2026-10-01 | Table |
| 3 | 03-exceptions-final-sale.txt | POL-003 | Support Policy Owner | 1.0 | 15/10/2026 | Bullets |
| 4 | 04-partial-refunds-store-credit.txt | POL-004 | Support Operations Lead | 1.0 | October 20, 2026 | Prose |
| 5 | 05-disputes-chargebacks.txt | POL-005 | Payments Operations Lead | 1.0 | 01-Nov-2026 | Bullets and table |
| 6 | 06-decline-communication.txt | POL-006 | Support Policy Owner | 1.0 | 2026-10-01 | Prose |

## Known problems and the expected pipeline behaviour

| Doc | Planted problem | Expected behaviour in step E |
| --- | --- | --- |
| 1 | None. Clean baseline; keeps every Week 2 fact (30 days, no partial refunds, no store credit, human approval). | Extracted cleanly with high confidence. |
| 2 | Accessories row has no return window (missing term). | Window is null, never 30. Rule is flagged, not invented. |
| 3 | Faulty or damaged items: "within a reasonable time" (vague, no number of days). Date is day-first (15/10/2026). Amount in rupees (Rs. 500). | Refund type or window ambiguous with a null window and an ambiguity note; routed to the policy owner. Date becomes 2026-10-15. Amount becomes minor units plus currency code. |
| 4 | Disagrees with POL-001: offers partial refunds and store credit, where POL-001 sections 3 and 4 say neither. Different owner; later date; no precedence stated. US-style date; amount in INR. | Conflict is detected and both rules go to the review queue; neither is indexed until the owner decides. Date becomes 2026-10-20. |
| 5 | Two currencies in one table (EUR 250, USD 300). Third date style (01-Nov-2026). Rule that an open chargeback blocks a refund. | Currency code kept per amount. Date becomes 2026-11-01. The chargeback rule is extracted as an exception that can override an eligible refund. |
| 6 | None. Written from the 2026-10-06 decline disclosure decision. Raw reason names are deliberately not in the text. | Extracted cleanly. Matches the decision record. |

## Rules for the corpus

- The poisoned document for step I is not part of this corpus. It is added in the test environment only.
- Documents 2 to 5 are deliberately imperfect. Their problems are recorded here before the pipeline is run, so the answer key is not written after the results.
- Changing any document after the pipeline has run requires a new version number and a new entry here.
