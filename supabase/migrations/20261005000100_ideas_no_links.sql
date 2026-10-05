-- submit_idea is callable over PostgREST by any signed-in user, so enforce the
-- "no links" rule in the database too, not only in the API route.
-- Applied 2026-10-05.
alter table public.ideas
  add constraint ideas_no_links check (
    title !~* '(https?://|www\.)' and body !~* '(https?://|www\.)'
  );
