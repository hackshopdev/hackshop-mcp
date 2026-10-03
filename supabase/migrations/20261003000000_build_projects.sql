-- Saved build projects for hackshop.dev (Supabase project "hackshop",
-- ref gcmrtdevzgwvhdzromda). Applied 2026-10-03.
--
-- Auth: Clerk is configured as a Supabase third-party auth provider, so the
-- Clerk session JWT is the Supabase access token and `auth.jwt()->>'sub'` is
-- the Clerk user id. RLS limits every row to its owner. anon gets nothing.

create table if not exists public.build_projects (
  id uuid primary key default gen_random_uuid(),
  user_id text not null check (char_length(user_id) between 1 and 128),
  title text not null default 'Untitled build' check (char_length(title) <= 120),
  idea text not null default '' check (char_length(idea) <= 2000),
  device_ids text[] not null default '{}' check (cardinality(device_ids) <= 10),
  platform_id text check (platform_id is null or char_length(platform_id) <= 64),
  status text not null default 'draft' check (status in ('draft','ordering','building','done')),
  checklist jsonb not null default '{}'::jsonb check (pg_column_size(checklist) <= 20000),
  parts jsonb not null default '{}'::jsonb check (pg_column_size(parts) <= 20000),
  notes text not null default '' check (char_length(notes) <= 5000),
  source text check (source is null or char_length(source) <= 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists build_projects_user_updated_idx
  on public.build_projects (user_id, updated_at desc);

create or replace function public.build_projects_touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace trigger build_projects_touch before update on public.build_projects
  for each row execute function public.build_projects_touch_updated_at();

alter table public.build_projects enable row level security;

revoke all on table public.build_projects from anon;
revoke all on table public.build_projects from authenticated;
grant select, insert, update, delete on table public.build_projects to authenticated;
grant select, insert, update, delete on table public.build_projects to service_role;
revoke execute on function public.build_projects_touch_updated_at() from public, anon, authenticated;

create policy "build_projects_select_own" on public.build_projects
  for select to authenticated using ((select auth.jwt()->>'sub') = user_id);
create policy "build_projects_insert_own" on public.build_projects
  for insert to authenticated with check ((select auth.jwt()->>'sub') = user_id);
create policy "build_projects_update_own" on public.build_projects
  for update to authenticated
  using ((select auth.jwt()->>'sub') = user_id)
  with check ((select auth.jwt()->>'sub') = user_id);
create policy "build_projects_delete_own" on public.build_projects
  for delete to authenticated using ((select auth.jwt()->>'sub') = user_id);
