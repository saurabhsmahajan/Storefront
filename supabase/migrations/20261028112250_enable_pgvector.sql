-- Week 4 step B: enable pgvector for the policy index.
-- Installed in the "extensions" schema, which is the Supabase convention.
create extension if not exists vector with schema extensions;