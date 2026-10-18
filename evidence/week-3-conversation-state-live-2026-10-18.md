# Week 3 step H: conversation state in Postgres, live run

Run as the host identity (agent_host), a test customer, a staff reviewer and an anonymous stranger. The model is not called here; the calls are scripted so the test isolates storage, tags and RLS.

```
== 1. A conversation across three separate calls (new store each call) ==
call 1: stored customer; rebuilt 1 message(s) from Postgres
call 2: stored tool; rebuilt 2 message(s) from Postgres
call 3: stored model; rebuilt 3 message(s) from Postgres
call 4: stored customer; rebuilt 4 message(s) from Postgres
call 5: stored tool; rebuilt 5 message(s) from Postgres
call 6: stored model; rebuilt 6 message(s) from Postgres
call 7: stored customer; rebuilt 7 message(s) from Postgres
--- history the model would receive on the next call ---
user: [customer says, unverified] My order 5eed0000-0000-4000-8000-0000000001a1 is still pending, why? | [tool result: get_order, verified] {"status":"pending","total_minor":4200}
assistant: Your order is pending. I am checking the payment.
user: [customer says, unverified] And why did my card fail? | [tool result: get_payment_status, verified] {"attempts":[{"result":"refused"}]}
assistant: The payment could not be authorised.
user: [customer says, unverified] Please refund me.

== 2. The tags, queried as the reviewer ==
1  customer verified=false 
2  tool     verified=true get_order
3  model    verified=false 
4  customer verified=false 
5  tool     verified=true get_payment_status
6  model    verified=false 
7  customer verified=false 

== 3. Model text cannot be stored as verified ==
PASS  insert model row with verified=true -> refused: cannot insert a non-DEFAULT value into column "verified"
PASS  insert model row labelled as a tool result (no tool name) -> refused: new row for relation "messages" violates check constraint "messages_tool_name_matches_provenance"
PASS  model text stored through the store -> verified=false

== 4. Row-level security ==
PASS  customer reads own messages -> 8
PASS  another customer reads this conversation -> 0 row(s)
PASS  customer inserts a message -> refused: new row violates row-level security policy for table "messages"
PASS  customer starts a conversation for themselves -> refused: new row violates row-level security policy for table "conversations"

== 5. Append-only ==
PASS  host updates a message -> permission denied for table messages
PASS  host deletes messages -> permission denied for table messages

== 6. Handoff package reads the tags ==
findings from tool rows: 2 (mcp:get_order, mcp:get_payment_status)
agent note (unverified): refund approved
customer message: Please refund me.

conversation id: 4fa91eef-c8e0-4044-bd5b-ddd180226f8c
```
