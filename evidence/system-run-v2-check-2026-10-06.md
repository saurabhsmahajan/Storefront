# Specialist prompts v2 check: before and after for D6 (2026-10-06)

Model: claude-sonnet-5-5
Change: split subtasks always get an Order ID line, and the specialist prompts say to name that order in the first sentence (commit 1bbdb97). Planner prompt unchanged (v1).
Messages: X2 (the defect), #17 (the other split, not expected to change) and #1 (a single-intent control, must be unchanged).
Before: evidence/system-run-decompose-2026-10-06.md and evidence/system-decompose-scores-2026-10-06.md. Run once, replies unedited.

## X2. Two orders

Message: Where is 5eed0000-0000-4000-8000-000000000103, and can I get a refund on 5eed0000-0000-4000-8000-000000000104?

Trace: route=multi:order_status+refund, outcome=escalated, escalation={"trigger":"policy_gap","by":"code"}, ms=10084

Subtasks:

```json
[
 {
  "id": "s1",
  "specialist": "order_status",
  "question": "Where is 5eed0000-0000-4000-8000-000000000103",
  "order_id": "5eed0000-0000-4000-8000-000000000103"
 },
 {
  "id": "s2",
  "specialist": "refund",
  "question": "can I get a refund on 5eed0000-0000-4000-8000-000000000104?",
  "order_id": "5eed0000-0000-4000-8000-000000000104"
 }
]
```

Reply:

> Order 5eed0000-0000-4000-8000-000000000103 is marked as paid, so payment was completed. It was placed on 2026-10-02 (3 days ago), and the total is 1599.00 INR.
> 
> I can't see shipping, tracking, or delivery information, so I can't tell you where the package is right now. I can only see the order status.
> 
> For order 5eed0000-0000-4000-8000-000000000104, I can't say yes or no to a refund. The refund policy doesn't cover this case.
> 
> - **Status:** Cancelled
> - **Total:** 1299.00 INR
> - **Age:** 11 days
> - **Payment:** The payment was authorised but not captured. An authorisation that wasn't captured is a hold, not a completed charge.
> 
> A human support agent decides every refund.
> 
> I'm passing your case to a human agent with this information. They will look into it and decide what happens next.

Score: Correct ?, Invented ?, Escalation ?

## 17. Policy gap

Message: Order 5eed0000-0000-4000-8000-000000000104 got cancelled but I was charged. Why was it cancelled and will I get my money back?

Trace: route=multi:order_status+refund, outcome=escalated, escalation={"trigger":"policy_gap","by":"code"}, ms=13215

Subtasks:

```json
[
 {
  "id": "s1",
  "specialist": "order_status",
  "question": "Order 5eed0000-0000-4000-8000-000000000104 got cancelled but I was charged. Why was it cancelled",
  "order_id": "5eed0000-0000-4000-8000-000000000104"
 },
 {
  "id": "s2",
  "specialist": "refund",
  "question": "I was charged. Why was it cancelled and will I get my money back?",
  "order_id": "5eed0000-0000-4000-8000-000000000104"
 }
]
```

Reply:

> Order 5eed0000-0000-4000-8000-000000000104 shows as **cancelled**. It was placed on 2026-09-24, which was 11 days ago, and the total is 1299.00 INR.
> 
> I can't see why it was cancelled. I also can't see payment details, so I can't tell whether you were charged. Another team member handles refunds and payment questions, and they can look into the charge for you.
> 
> Order 5eed0000-0000-4000-8000-000000000104 is cancelled. The refund policy doesn't cover cancelled orders, so I can't tell you whether you'll get a refund. The order total is 1299.00 INR and it is 11 days old.
> 
> On the charge, the payment was authorised but not captured. An authorisation without a capture is a hold, not a completed charge. I can't say whether any money has left your account.
> 
> I also can't say why the order was cancelled.
> 
> I'm passing your case to a human agent with this information. They will look into it and decide what happens next.

Score: Correct ?, Invented ?, Escalation ?

## 1. Order status

Message: Where is my order 5eed0000-0000-4000-8000-000000000103?

Trace: route=order_status, outcome=resolved, escalation=null, ms=5807

Subtasks:

```json
[]
```

Reply:

> Order 5eed0000-0000-4000-8000-000000000103 is marked **paid**, so payment was completed. The total is 1599.00 INR. It was placed on 2026-10-02, which is 3 days ago.
> 
> I can't see shipping, tracking or delivery information, so I can't tell you where the order is right now.

Score: Correct ?, Invented ?, Escalation ?
