   Transcript confirmation (from C:\Users\HP\.claude\projects\...\<session-id>.jsonl):
   "hookEvent":"PostToolUse"
   "stdout":"format-on-edit: formatted D:\\Saurabh\\Profile Building\\Projects\\storefront\\frontend\\src\\main.ts\n"
   "stderr":""
   "exitCode":0
   "command":"node .claude/hooks/format-on-edit.mjs"
   "durationMs":1513

   Confirms: the hook ran and formatted the file via its own invocation,
   separate from and prior to Claude's own CLAUDE.md-driven prettier run
   (which reported "unchanged" immediately after).