-- Idea submissions and upvotes for hackshop.dev/ideas (Supabase project
-- "hackshop", ref gcmrtdevzgwvhdzromda). NOT applied yet: the lead reviews
-- and applies it.
--
-- Auth: Clerk is configured as a Supabase third-party auth provider, so the
-- Clerk session JWT is the Supabase access token and `auth.jwt()->>'sub'` is
-- the Clerk user id.
--
-- Security model:
--   ideas         anon and authenticated may read only the public columns of
--                 published rows. Column grants keep user_id,
--                 moderation_token and report_count unreadable. Clients never
--                 insert or update rows: submit_idea() inserts, and counters
--                 and status change only inside security-definer functions.
--   idea_votes    authenticated users read, add and remove their own votes,
--                 and may only vote on published ideas. A trigger keeps
--                 ideas.vote_count in sync.
--   idea_reports  no client access at all; report_idea() writes it.
--   hide_idea()   callable by anon; the per-idea moderation_token (emailed to
--                 the site owner) is the secret.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.ideas (
  id uuid primary key default gen_random_uuid(),
  user_id text not null check (char_length(user_id) between 1 and 128),
  display_name text not null default 'A builder'
    check (char_length(display_name) between 1 and 40),
  title text not null check (char_length(title) between 4 and 80),
  body text not null default '' check (char_length(body) <= 600),
  size text check (size in ('pocket', 'desk', 'wall', 'hidden')),
  interaction text check (interaction in ('voice', 'touch', 'light-button')),
  sensing text check (sensing in ('camera', 'air-quality', 'none')),
  budget text check (budget in ('25', '50', '100', 'none')),
  suggested_device_id text
    check (suggested_device_id ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  status text not null default 'published' check (status in ('published', 'hidden')),
  vote_count integer not null default 0 check (vote_count >= 0),
  report_count integer not null default 0 check (report_count >= 0),
  moderation_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create index if not exists ideas_published_top_idx
  on public.ideas (vote_count desc, created_at desc) where status = 'published';
create index if not exists ideas_published_new_idx
  on public.ideas (created_at desc) where status = 'published';
create index if not exists ideas_user_created_idx
  on public.ideas (user_id, created_at desc);

create table if not exists public.idea_votes (
  idea_id uuid not null references public.ideas (id) on delete cascade,
  user_id text not null default (auth.jwt() ->> 'sub')
    check (char_length(user_id) between 1 and 128),
  created_at timestamptz not null default now(),
  primary key (idea_id, user_id)
);

create index if not exists idea_votes_user_idx
  on public.idea_votes (user_id, created_at desc);

create table if not exists public.idea_reports (
  idea_id uuid not null references public.ideas (id) on delete cascade,
  user_id text not null check (char_length(user_id) between 1 and 128),
  created_at timestamptz not null default now(),
  primary key (idea_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Row level security and grants
-- ---------------------------------------------------------------------------

alter table public.ideas enable row level security;
alter table public.idea_votes enable row level security;
alter table public.idea_reports enable row level security;

-- Supabase's default privileges grant everything on new public tables to anon
-- and authenticated. Start from nothing and grant back only what is needed.
revoke all on table public.ideas from anon, authenticated;
revoke all on table public.idea_votes from anon, authenticated;
revoke all on table public.idea_reports from anon, authenticated;

-- Public columns only. user_id, moderation_token and report_count are left out
-- on purpose, so `select *` and any select naming them is refused.
grant select (
  id,
  display_name,
  title,
  body,
  size,
  interaction,
  sensing,
  budget,
  suggested_device_id,
  status,
  vote_count,
  created_at
) on table public.ideas to anon, authenticated;

grant select, delete on table public.idea_votes to authenticated;
grant insert (idea_id, user_id) on table public.idea_votes to authenticated;

grant all on table public.ideas to service_role;
grant all on table public.idea_votes to service_role;
grant all on table public.idea_reports to service_role;

create policy "ideas_select_published" on public.ideas
  for select to anon, authenticated
  using (status = 'published');

create policy "idea_votes_select_own" on public.idea_votes
  for select to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id);
create policy "idea_votes_insert_own" on public.idea_votes
  for insert to authenticated
  with check (
    (select auth.jwt() ->> 'sub') = user_id
    and exists (
      select 1 from public.ideas i
      where i.id = idea_votes.idea_id and i.status = 'published'
    )
  );
create policy "idea_votes_delete_own" on public.idea_votes
  for delete to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id);

-- idea_reports: RLS on and no policies, so clients can neither read nor write.

-- ---------------------------------------------------------------------------
-- Vote counter
-- ---------------------------------------------------------------------------

create or replace function public.ideas_sync_vote_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.ideas set vote_count = vote_count + 1 where id = new.idea_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.ideas set vote_count = greatest(vote_count - 1, 0) where id = old.idea_id;
    return old;
  end if;
  return null;
end;
$$;

create or replace trigger idea_votes_sync_count
  after insert or delete on public.idea_votes
  for each row execute function public.ideas_sync_vote_count();

revoke execute on function public.ideas_sync_vote_count() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- submit_idea: the only way clients create ideas. Max 5 per user per 24 h.
-- ---------------------------------------------------------------------------

create or replace function public.submit_idea(
  p_title text,
  p_body text default '',
  p_display_name text default null,
  p_size text default null,
  p_interaction text default null,
  p_sensing text default null,
  p_budget text default null,
  p_suggested_device_id text default null
)
returns table (id uuid, moderation_token uuid)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user text := auth.jwt() ->> 'sub';
  v_recent integer;
  v_id uuid;
  v_token uuid;
begin
  if v_user is null or v_user = '' then
    raise exception 'sign_in_required' using errcode = '28000';
  end if;

  -- Serialize submits per user so the daily cap cannot be raced.
  perform pg_advisory_xact_lock(hashtext('submit_idea:' || v_user));

  select count(*) into v_recent
  from public.ideas i
  where i.user_id = v_user
    and i.created_at > now() - interval '24 hours';

  if v_recent >= 5 then
    raise exception 'daily_limit'
      using errcode = 'P0001', hint = 'Max 5 ideas per user per 24 hours.';
  end if;

  insert into public.ideas as i (
    user_id,
    display_name,
    title,
    body,
    size,
    interaction,
    sensing,
    budget,
    suggested_device_id
  )
  values (
    v_user,
    coalesce(nullif(btrim(p_display_name), ''), 'A builder'),
    btrim(p_title),
    coalesce(btrim(p_body), ''),
    nullif(p_size, ''),
    nullif(p_interaction, ''),
    nullif(p_sensing, ''),
    nullif(p_budget, ''),
    nullif(p_suggested_device_id, '')
  )
  returning i.id, i.moderation_token into v_id, v_token;

  return query select v_id, v_token;
end;
$$;

revoke execute on function public.submit_idea(text, text, text, text, text, text, text, text)
  from public, anon;
grant execute on function public.submit_idea(text, text, text, text, text, text, text, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- report_idea: one report per user per idea; 3 reports hide the idea.
-- Returns true when a new report was recorded.
-- ---------------------------------------------------------------------------

create or replace function public.report_idea(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user text := auth.jwt() ->> 'sub';
  v_added integer;
begin
  if v_user is null or v_user = '' then
    raise exception 'sign_in_required' using errcode = '28000';
  end if;

  if not exists (
    select 1 from public.ideas i where i.id = p_id and i.status = 'published'
  ) then
    return false;
  end if;

  insert into public.idea_reports (idea_id, user_id)
  values (p_id, v_user)
  on conflict (idea_id, user_id) do nothing;
  get diagnostics v_added = row_count;

  if v_added = 0 then
    return false;
  end if;

  update public.ideas i
  set report_count = i.report_count + 1,
      status = case when i.report_count + 1 >= 3 then 'hidden' else i.status end
  where i.id = p_id;

  return true;
end;
$$;

revoke execute on function public.report_idea(uuid) from public, anon;
grant execute on function public.report_idea(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- hide_idea: one-click hide from the moderation email. The token is the
-- secret, so anon may call it. Returns true when the token matched.
-- ---------------------------------------------------------------------------

create or replace function public.hide_idea(p_id uuid, p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_id is null or p_token is null then
    return false;
  end if;

  update public.ideas i
  set status = 'hidden'
  where i.id = p_id and i.moderation_token = p_token;

  return found;
end;
$$;

revoke execute on function public.hide_idea(uuid, uuid) from public;
grant execute on function public.hide_idea(uuid, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Seed ideas (from "15 AI Agent Body Ideas You Can Build Today"). Posted as
-- hackshop with zero votes. Never seed or fake votes. IDs match
-- site/lib/ideas/seed.ts so seeded pages keep their URLs.
-- ---------------------------------------------------------------------------

insert into public.ideas (
  id, user_id, display_name, title, body,
  size, interaction, sensing, budget, suggested_device_id,
  vote_count, created_at
)
values
  ('347fda0c-53ac-496c-9262-657596e0632d', 'hackshop', 'hackshop',
   'Round desk companion',
   'A round touch screen on your desk with an animated avatar, push-to-talk and replies as captions.',
   'desk', 'voice', 'none', null, 'waveshare-esp32-s3-touch-amoled-1-75c',
   0, '2026-10-05T12:00:00Z'),
  ('d3fbbf21-c9a0-463e-9356-f4df2eecfe69', 'hackshop', 'hackshop',
   'Desk camera helper',
   'Ask Muse to look at your whiteboard or the parts on your bench and get a photo back.',
   'desk', 'voice', 'camera', null, 'seeed-sensecap-watcher',
   0, '2026-10-05T11:59:00Z'),
  ('479c5615-784d-43a4-89d6-e9701e3be181', 'hackshop', 'hackshop',
   'Air-quality monitor',
   'Ask whether the room is stuffy and read CO2, tVOC, temperature and humidity on a desk screen.',
   'desk', 'touch', 'air-quality', null, 'seeed-sensecap-indicator',
   0, '2026-10-05T11:58:00Z'),
  ('8fafe129-9e94-444e-9617-c8e151b90ca3', 'hackshop', 'hackshop',
   'Glanceable status screen',
   'A small color screen that shows what your agent is up to and any picture it sends.',
   'desk', 'light-button', 'none', null, 'ideaspark-esp32-1-9-lcd',
   0, '2026-10-05T11:57:00Z'),
  ('a321204f-60c2-4751-ad01-af5574e2e05b', 'hackshop', 'hackshop',
   'Pocket voice note taker',
   'Press a button, say the thought, and get it transcribed with a text reply on a pocket screen.',
   'pocket', 'voice', 'none', null, 'm5stack-sticks3',
   0, '2026-10-05T11:56:00Z'),
  ('3b6983e1-036c-4b9b-a0c7-82d4a0225ecb', 'hackshop', 'hackshop',
   'Kitchen recipe helper',
   'A palm-size buddy on the counter for quick questions like unit conversions, with pictures on its screen.',
   'desk', 'voice', 'none', null, 'aipi-lite',
   0, '2026-10-05T11:55:00Z'),
  ('791f89e2-eb4f-4ede-8c3a-079710bcbceb', 'hackshop', 'hackshop',
   'Shelf voice point',
   'A speaker-mic puck for the living room with push-to-talk, an LED status ring and a mute switch.',
   'hidden', 'voice', 'none', null, 'home-assistant-voice-pe',
   0, '2026-10-05T11:54:00Z'),
  ('aa3cbf76-cbae-43f0-94d2-fedfa91f7e86', 'hackshop', 'hackshop',
   'Family calendar and morning briefing',
   'A color e-paper display where your agent posts the day''s plan, reminders or a morning briefing.',
   'wall', 'light-button', 'none', null, 'seeed-reterminal-e1002',
   0, '2026-10-05T11:53:00Z'),
  ('f5bcf3a5-7e40-4b56-8e02-bfe3c8ac23c9', 'hackshop', 'hackshop',
   'Shopping list by the fridge',
   'Black-and-white e-paper on the fridge that updates as people add items from their phones.',
   'wall', 'light-button', 'none', null, 'seeed-reterminal-e1001',
   0, '2026-10-05T11:52:00Z'),
  ('1603112f-2217-432f-b512-f7e370d17003', 'hackshop', 'hackshop',
   'Home server helper',
   'Ask what''s using all the disk space on your Pi, or have your agent check each morning whether backups ran.',
   'hidden', 'light-button', 'none', null, 'raspberry-pi-5',
   0, '2026-10-05T11:51:00Z'),
  ('a29db261-ba54-490a-8edb-71aeaf0ac5d4', 'hackshop', 'hackshop',
   'Sensor alert relay',
   'Any script on a tiny Linux board can message your agent, like "The garage door has been open for an hour."',
   'hidden', 'light-button', 'none', null, 'raspberry-pi-zero-2w',
   0, '2026-10-05T11:50:00Z'),
  ('24454b28-acf5-4757-8a28-eacc6ee01ddb', 'hackshop', 'hackshop',
   'Busy light by your door',
   'A status light your agent turns red when you''re on a call (needs a small code change).',
   'hidden', 'light-button', 'none', null, 'espressif-esp32-c5-devkitc-1',
   0, '2026-10-05T11:49:00Z')
on conflict (id) do nothing;
