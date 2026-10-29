-- Week 4 step B: private bucket for the policy documents.
-- Private, plain text only, small files only.
-- No policies are added on storage.objects, so only the service role
-- (the ingestion pipeline) can read or write. Customers and agents cannot.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('policy-docs', 'policy-docs', false, 1048576, array['text/plain'])
on conflict (id) do nothing;