## Webhook test — AUTHORISATION, success=true (2026-10-01)

- Order id: bac29fdd-b63d-43c1-a69d-4613ac67a5da (was "pending" before this test)
- Adyen's test notification tool, edited merchantReference to this order's id
- Adyen pspReference: AYLMELACP4N8O...
- Function logs: [webhook] received 1 item(s) → [payment_events] recorded →
  [orders] marked paid
- Confirmed in Supabase: orders.status = 'paid', orders.psp_reference set correctly
- This confirms: HMAC verification passed (a failed signature would have
  stopped processing before reaching payment_events), and Adyen's test tool
  recalculates the signature automatically when the payload is edited and sent
  through its interface — editing the raw JSON preview alone does not update
  the signature shown there, but the actual request sent is correctly re-signed.


  ## Webhook test — AUTHORISATION, success=false (2026-10-01)

- Order id: 2ffe44c8-1e23-4ffc-be69-d8d842f2a4f5 (the same order declined
  in the frontend during Step E's test — was "pending" since then)
- Adyen pspReference: AOQJ7L49KM9WOES8
- Confirmed: orders.status = 'cancelled', psp_reference set correctly
- This closes the loop from Step E: the browser reported "Refused" at the
  time, but the database had no record of that outcome until this webhook
  arrived — demonstrating why orders.status must only change from a
  verified server-to-server event, never from what the client reports.