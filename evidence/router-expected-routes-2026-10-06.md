   # Router expected routes (2026-10-06)

   The answer key for comparing the classifier Router with the agentic Router.
   Written before either was built. Acceptable routes per message: a Router's
   route counts as correct if it is in the set. Mixed requests have two
   acceptable routes, because a single-label Router can only choose one. Splitting
   them is step H.

   Routes: order_status, decline, refund, human_request, out_of_scope.

   | # | Category | Acceptable routes |
   |---|---|---|
   | 1 | Order status | order_status |
   | 2 | Order status | order_status |
   | 3 | Order status | order_status |
   | 4 | Order status | order_status |
   | 5 | Order status | order_status |
   | 6 | Order status | order_status |
   | 7 | Decline | decline |
   | 8 | Decline | decline |
   | 9 | Decline | decline |
   | 10 | Decline | decline |
   | 11 | Refund | refund |
   | 12 | Refund | refund |
   | 13 | Refund | refund |
   | 14 | Refund | refund |
   | 15 | Mixed | decline, refund |
   | 16 | Mixed | order_status, refund |
   | 17 | Policy gap | refund |
   | 18 | Human request | human_request |
   | 19 | Human request | human_request |
   | 20 | Out of scope | out_of_scope |
   | 21 | Out of scope | out_of_scope |

   Notes:
   - #17 goes to refund because the refund specialist holds the rule that says
     the policy has no rule for cancelled orders.
   - #5 has no order ID: it goes to order_status, which asks for it.