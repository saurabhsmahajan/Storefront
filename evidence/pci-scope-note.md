Why routing card entry through Adyen's Drop-in (an Adyen-hosted iframe, not your own form fields) keeps your servers out of PCI DSS's cardholder-data-environment scope, which is what typically qualifies a merchant for SAQ-A, the simplest self-assessment tier.
The open question the post is actually about: once an agent (your Refund Eligibility or Payment Decline Explainer specialist) starts reading payment_events or orders — which will contain Adyen references, decline reasons, maybe tokenized metadata — does that introduce a "system component" SAQ-A's scope assumptions never anticipated? You don't have to answer this definitively now; the post's whole point is that this question doesn't have an obvious answer yet.

# Checkout test log — 2026-09-30

## Successful payment
- Card: 4111 1111 1111 1111, expiry 03/30, CVC 737, holder name: Test User
- orderId: df215596-d08d-43b2-819b-8f58ed1648bd
- Adyen PSP reference: WNJ9CC45XNTZJMV5
- Result: Authorised (confirmed in Adyen dashboard and browser console)
- orders.status in Supabase: still "pending" — no webhook received yet

## Declined payment
- Card: 4111 1111 1111 1111, expiry 03/30, CVC 747, holder name: UNKNOWN
- orderId: 2ffe44c8-1e23-4ffc-be69-d8d842f2a4f5
- Result: Refused (browser console: onPaymentFailed; page showed "Payment failed: Refused")
- Adyen dashboard: [confirm status once checked]
- orders.status in Supabase: still "pending"

## Observation
Both outcomes leave orders.status as "pending" in the database, since nothing
server-side has updated it yet. This is the gap Step F's webhook closes — the
frontend and Adyen both know the true outcome, but the database (the only
source of truth an agent should trust) does not, until a webhook confirms it.