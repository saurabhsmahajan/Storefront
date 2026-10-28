# Embedding model and pgvector setup (2026-10-28)

Week 4, step B. Recorded before any policy text is embedded.

## Decision

- Provider: Voyage AI (Anthropic does not offer an embedding model).
- Model: `voyage-4`. This is the exact string sent to the API. Voyage does not publish a separate version number for it, so the version is recorded as the model string plus the date first used (2026-10-28). If the provider changes what `voyage-4` points to, the first sign should be a change in the retrieval results on the golden set.
- Dimensions: 1024 (the default). The `policy_chunks` embedding column will be sized to match.
- Context length: 32,000 tokens.
- Free allowance: 200 million tokens, far above the size of the 4 to 6 document corpus.
- Why this tier: the balanced tier of the voyage-4 family (voyage-4-large is the quality option, voyage-4-lite the cheapest). Treated as a hypothesis, like the Claude tier choices in step C. If the Week 4 retrieval measurements show misses that look like embedding quality, `voyage-4-large` is a one-line swap. All models in the family produce compatible embeddings.
- Source for the model facts: Voyage AI model documentation, checked 2026-10-28.

## pgvector

- Extension: `vector` 0.8.2, installed in the `extensions` schema, enabled on the remote Supabase project on 2026-10-28.
- Applied by migration `20261028112250_enable_pgvector.sql` (the only migration pending before the push; the earlier three matched local and remote).

## Key handling

- `VOYAGE_API_KEY` is in the local `.env` (ignored by git, confirmed with `git check-ignore`), listed with an empty value in `.env.example`, and saved as a GitHub Actions repository secret.
- No CI step reads the secret yet. CI stays offline until a step needs live embeddings.
- The secrets scanner (`scripts/scan-secrets.mjs`) now has a "Voyage AI API key" pattern (prefix `pa-`), with a fake key in the tests. Scanner tests pass (4 of 4) and the scan of files and history passes.

## Risk to carry into step J

- Policy text is sent to Voyage AI's servers to be embedded. Log this in the risk register as a third-party data flow, and record the provider's retention terms when they are checked.
- The model name and version are stored with every chunk (step G), so a model change can be rehearsed with a shadow index in Week 10.
