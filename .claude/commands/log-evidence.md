---
description: Append a dated, structured entry to an evidence file
argument-hint: <evidence-file-name> <what was tested>
allowed-tools: Read, Edit
---

Append an entry to the evidence file named in the first word of: $ARGUMENTS

Rules:

- The file must be inside /evidence. If it does not exist, create it with a title line.
- Today's date is the entry heading. Use the real current date.
- Use exactly these fields: Tested, Prompt or action, Result, Known limits.
- Result must be what actually happened in this session. Quote errors
  and denial messages verbatim. Never invent or smooth over results.
- If Known limits is unknown, write "none identified", not a guess.
- Do not edit any file outside /evidence.
