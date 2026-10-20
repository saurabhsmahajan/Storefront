# Week 3 step G: the hook after a real approval

The approval was created by clicking Approve on the live review screen. This script reads the approval file the screen wrote, then asks the PreToolUse hook about the stub execute_refund call. The "eligibility check succeeded" state is set by the script; the ordering rule is proven separately.

```
Package: message-11-refund_recommendation.json   order: 5eed0000-0000-4000-8000-000000000103
Approval on file: by reviewer@storefront.test, until 2026-10-20T13:28:59.632Z, consumed=false
Hook decision before use, with the approval: ALLOW
The stub ran once (it records, it does not refund).
Hook decision after use: DENY
```
