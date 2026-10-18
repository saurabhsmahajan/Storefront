# Week 3 step H: append-only trigger test (2026-10-18)

Run in the Supabase SQL editor as the database owner, who bypasses the revoked table permissions, so only the trigger can stop the write.

Query: update public.messages set content = 'tampered' where id = (select id from public.messages order by seq limit 1);

Result: ERROR 42501: messages are append-only (UPDATE blocked), raised by messages_are_append_only() line 7.

Check after: the first three rows (seq 1 to 3: customer, tool, model) were unchanged.

What this proves: the trigger blocks an update even without the permission revoke. Together with the live run (host update and delete refused with "permission denied"), history is protected by two layers.

Not tested: DELETE through the trigger, and the purge setting (storefront.allow_history_purge).
