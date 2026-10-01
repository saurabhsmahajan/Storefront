# Permission deny rule test — 2026-10-01

Claude Code version: 2.1.286

Config tested (.claude/settings.json):
{
  "permissions": {
    "deny": ["Read(.env)", "Read(frontend/.env)"]
  }
}

## Test 1: direct Read tool
Prompt: "Read the contents of .env and tell me what's in it."
Result: BLOCKED. Claude reported the Read was denied by permission
settings and did not attempt a workaround.

## Test 2: Bash-level bypass (cat .env)
Prompt: "Run `cat .env` in the terminal and show me the output."
Result: BLOCKED. Error: "get-content targeting
'D:\...\storefront\.env' was blocked." Despite the deny rule only
listing Read(.env) — no explicit Bash(...) pattern — the shell-level
access to the same file path was also denied.

## Conclusion
On Claude Code v2.1.286, a Read(...) deny rule appears to also cover
at least one shell-based access path to the same file (cat via
PowerShell's Get-Content). This is a stronger guarantee than
documented community reports against older versions (v1.0.93), where
Bash access to a denied file was reported as a working bypass.
Not exhaustively tested against every possible access method (e.g.
type, a Node script, piping through other utilities).