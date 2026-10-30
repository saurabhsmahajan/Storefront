# Agent register

Source of truth. The token issuer reads this file and refuses to issue
any scope not listed here.

| Agent (SPIFFE-style name)                | Owner           | Purpose                                | Allowed scopes                                                         | Approved by     | Review date |
| ---------------------------------------- | --------------- | -------------------------------------- | ---------------------------------------------------------------------- | --------------- | ----------- |
| spiffe://storefront.local/agents/shopper | Saurabh Mahajan | Talks to the customer, relays requests | catalog:read, order:create, order:read, refund:request, payment:charge | Saurabh Mahajan | 2027-01-28  |
| spiffe://storefront.local/agents/order   | Saurabh Mahajan | Creates and reads orders               | order:create, order:read, refund:request, payment:charge               | Saurabh Mahajan | 2027-01-28  |
| spiffe://storefront.local/agents/payment | Saurabh Mahajan | Charges an order, once                 | payment:charge                                                         | Saurabh Mahajan | 2027-01-28  |
