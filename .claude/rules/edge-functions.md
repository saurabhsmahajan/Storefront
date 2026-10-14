---
paths:
  - "supabase/functions/**"
---

# Edge Functions

- Deno runtime. Import with `npm:` or `jsr:` specifiers, not bare Node modules.
- Never use the service-role key in customer-facing tools; use the caller's scoped credential so RLS applies.
- Return structured errors: type, retryable, next action.
- Never return payment fields beyond what the tool policy note allows.
