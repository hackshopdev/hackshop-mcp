-- Private hardware discovery. Existing Hackshop Supabase project.
-- All data and functions are service-only; Clerk/worker authorization lives in server routes.
-- SECURITY INVOKER is intentional: service_role already bypasses RLS.
create table if not exists public.discovery_runs (
  id uuid primary key default gen_random_uuid(),
  run_key text not null unique check (char_length(run_key) between 1 and 220),
  status text not null default 'running' check (status in ('running','completed','partial','failed','budget_exhausted')),
  window_start timestamptz not null, window_end timestamptz not null check (window_end > window_start),
  budget_date date not null default ((now() at time zone 'UTC')::date),
  lease_owner text not null check (char_length(lease_owner) between 1 and 160),
  lease_expires_at timestamptz not null default now() + interval '15 minutes',
  provider_status jsonb not null default '{}' check (jsonb_typeof(provider_status) = 'object' and pg_column_size(provider_status) <= 8000),
  checkpoints jsonb not null default '{}' check (jsonb_typeof(checkpoints) = 'object' and pg_column_size(checkpoints) <= 20000),
  credit_reservations jsonb not null default '{}' check (jsonb_typeof(credit_reservations) = 'object' and pg_column_size(credit_reservations) <= 40000),
  grok_receipt jsonb check (grok_receipt is null or (jsonb_typeof(grok_receipt) = 'object' and pg_column_size(grok_receipt) <= 2000)),
  coverage_notes jsonb not null default '[]' check (jsonb_typeof(coverage_notes) = 'array' and pg_column_size(coverage_notes) <= 20000),
  error_code text check (char_length(error_code) <= 100),
  started_at timestamptz not null default now(), finished_at timestamptz
);
create unique index if not exists discovery_grok_request_idx on public.discovery_runs ((grok_receipt->>'request_id')) where grok_receipt is not null;
create index if not exists discovery_runs_budget_idx on public.discovery_runs (budget_date);
alter table public.discovery_runs add column if not exists grok_reservations jsonb not null default '{}';

create table if not exists public.discovery_candidates (
  id uuid primary key default gen_random_uuid(),
  project_key text not null unique check (char_length(project_key) between 1 and 220),
  proposal_kind text not null default 'new' check (proposal_kind in ('new','enrich')),
  target_example_id text check (target_example_id is null or target_example_id ~ '^[a-z0-9-]{1,120}$'),
  research_status text not null default 'discovered' check (research_status in ('discovered','hydrated','researching','ready_for_review','needs_evidence','retryable_failed','duplicate','rejected')),
  publication_status text not null default 'unreviewed' check (publication_status in ('unreviewed','approved','pr_open','merged','site_live','verification_failed')),
  draft jsonb check (draft is null or (jsonb_typeof(draft) = 'object' and pg_column_size(draft) <= 30000)),
  draft_version integer not null default 1 check (draft_version >= 1),
  draft_hash text check (draft_hash is null or draft_hash ~ '^[a-f0-9]{64}$'),
  unresolved_claims jsonb not null default '[]' check (jsonb_typeof(unresolved_claims) = 'array' and pg_column_size(unresolved_claims) <= 20000),
  research_notes text not null default '' check (char_length(research_notes) <= 5000),
  approved_at timestamptz, approved_hash text, approved_by text,
  pr_url text, pr_head_sha text, merge_sha text, verified_at timestamptz,
  proof_urls jsonb not null default '[]',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (proposal_kind <> 'enrich' or target_example_id is not null)
);
create index if not exists discovery_candidates_review_idx on public.discovery_candidates (research_status, publication_status, updated_at desc);
alter table public.discovery_candidates add column if not exists approved_version integer;
alter table public.discovery_candidates add column if not exists base_record_hash text;

create table if not exists public.discovery_sources (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.discovery_candidates(id),
  source_key text not null unique,
  url text not null check (char_length(url) <= 2048 and url like 'https://%'),
  label text not null check (char_length(label) between 1 and 160),
  kind text not null check (kind in ('repo','guide','social_post','video','primary_docs','dataset')),
  author text check (char_length(author) <= 128), published_at text check (char_length(published_at) <= 40),
  excerpt text not null default '' check (char_length(excerpt) <= 1200),
  checked_at date not null, created_at timestamptz not null default now()
);
create index if not exists discovery_sources_candidate_idx on public.discovery_sources (candidate_id);

create table if not exists public.discovery_review_events (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.discovery_candidates(id),
  actor text not null check (char_length(actor) between 1 and 128),
  action text not null check (action in ('intake','edit','approve','reject','needs_research','mark_pr','mark_live')),
  old_hash text, new_hash text,
  reason text not null default '' check (char_length(reason) <= 600),
  metadata jsonb not null default '{}' check (pg_column_size(metadata) <= 8000),
  created_at timestamptz not null default now()
);

alter table public.discovery_runs enable row level security;
alter table public.discovery_candidates enable row level security;
alter table public.discovery_sources enable row level security;
alter table public.discovery_review_events enable row level security;
revoke all on table public.discovery_runs, public.discovery_candidates, public.discovery_sources, public.discovery_review_events from public, anon, authenticated;
grant select, insert, update on public.discovery_runs, public.discovery_candidates, public.discovery_sources to service_role;
grant select, insert on public.discovery_review_events to service_role;

create or replace function public.discovery_candidate(p_id uuid)
returns jsonb language sql security invoker set search_path = '' stable as $$
  select coalesce((select jsonb_build_object('candidate',
    to_jsonb(c) || jsonb_build_object('sources', coalesce((
      select jsonb_agg(to_jsonb(s) - 'candidate_id' - 'created_at' order by s.created_at)
      from public.discovery_sources s where s.candidate_id = c.id
    ), '[]'::jsonb)))
  from public.discovery_candidates c where c.id = p_id), '{"candidate":null}'::jsonb)
$$;

create or replace function public.discovery_inbox()
returns jsonb language sql security invoker set search_path = '' stable as $$
  select jsonb_build_object(
    'source','live',
    'candidates',coalesce((select jsonb_agg(public.discovery_candidate(c.id)->'candidate' order by c.updated_at desc)
      from (select id,updated_at from public.discovery_candidates order by updated_at desc limit 100) c),'[]'::jsonb),
    'runs',coalesce((select jsonb_agg(to_jsonb(r) order by r.started_at desc)
      from (select * from public.discovery_runs order by started_at desc limit 20) r),'[]'::jsonb),
    'stats', jsonb_build_object(
      'total',(select count(*) from public.discovery_candidates),
      'needs_review',(select count(*) from public.discovery_candidates where research_status='ready_for_review' and publication_status='unreviewed'),
      'needs_evidence',(select count(*) from public.discovery_candidates where research_status='needs_evidence'),
      'approved',(select count(*) from public.discovery_candidates where publication_status='approved'),
      'published',(select count(*) from public.discovery_candidates where publication_status='site_live')
    )
  )
$$;

create or replace function public.discovery_ingest_items(p_items jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  item jsonb; source jsonb; c public.discovery_candidates%rowtype;
  v_source_key text; existing uuid; v_draft jsonb; v_hash text; result jsonb := '[]';
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 25 then raise exception 'invalid_input'; end if;
  for item in select value from jsonb_array_elements(p_items) loop
    source := item->'source';
    v_source_key := encode(sha256(convert_to(source->>'url','UTF8')),'hex');
    perform pg_advisory_xact_lock(hashtext('discovery-source:' || v_source_key));
    select candidate_id into existing from public.discovery_sources where source_key = v_source_key;
    if existing is not null then
      select * into c from public.discovery_candidates where id = existing for update;
      -- A canonical post already assigned to another target is never silently reassigned.
      if c.project_key <> item->>'project_key' then
        result := result || jsonb_build_array(public.discovery_candidate(c.id)->'candidate');
        continue;
      end if;
    else
      perform pg_advisory_xact_lock(hashtext('discovery-project:' || (item->>'project_key')));
      insert into public.discovery_candidates(project_key,proposal_kind,target_example_id,base_record_hash)
      values (item->>'project_key',coalesce(item->>'proposal_kind','new'),item->>'target_example_id',item->>'base_record_hash')
      on conflict (project_key) do nothing;
      select * into c from public.discovery_candidates where project_key = item->>'project_key' for update;
      insert into public.discovery_sources(candidate_id,source_key,url,label,kind,author,published_at,excerpt,checked_at)
      values(c.id,v_source_key,source->>'url',source->>'label',source->>'kind',source->>'author',source->>'published_at',coalesce(source->>'excerpt',''),(source->>'checked_at')::date);
    end if;
    if c.publication_status = 'unreviewed' and c.research_status not in ('rejected','duplicate') then
      v_draft := coalesce(item->'draft',c.draft);
      -- This internal hash is computed by the server with the shared canonical JSON helper.
      -- Strict external worker schemas reject draft_hash; only service-side preparation adds it.
      v_hash := case when item ? 'draft' then item->>'draft_hash' else c.draft_hash end;
      if v_draft is not null and (v_hash is null or v_hash !~ '^[a-f0-9]{64}$') then raise exception 'invalid_input'; end if;
      if item->>'status' = 'ready_for_review' and (v_draft is null or jsonb_array_length(coalesce(item->'unresolved_claims','[]')) <> 0) then
        raise exception 'not_reviewable';
      end if;
      update public.discovery_candidates set
        draft = v_draft, draft_hash = v_hash,
        draft_version = draft_version + case when draft is distinct from v_draft then 1 else 0 end,
        research_status = coalesce(item->>'status',research_status),
        unresolved_claims = coalesce(item->'unresolved_claims','[]'),
        research_notes = coalesce(item->>'research_notes',''),
        proposal_kind = coalesce(item->>'proposal_kind',proposal_kind),
        target_example_id = coalesce(item->>'target_example_id',target_example_id),
        base_record_hash = coalesce(base_record_hash,item->>'base_record_hash'),
        updated_at = now()
      where id=c.id;
    end if;
    result := result || jsonb_build_array(public.discovery_candidate(c.id)->'candidate');
  end loop;
  return result;
end
$$;

create or replace function public.discovery_intake(p_url text,p_reviewer text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare result jsonb; v_hash text; c jsonb;
begin
  if char_length(p_reviewer) not between 1 and 128 then raise exception 'invalid_input'; end if;
  v_hash := encode(sha256(convert_to(p_url,'UTF8')),'hex');
  result := public.discovery_ingest_items(jsonb_build_array(jsonb_build_object(
    'project_key','url:' || v_hash,'status','discovered',
    'source',jsonb_build_object('url',p_url,'label','Submitted source','kind','guide','checked_at',(now() at time zone 'UTC')::date))));
  c := result->0;
  insert into public.discovery_review_events(candidate_id,actor,action) values((c->>'id')::uuid,p_reviewer,'intake');
  return jsonb_build_object('candidate',c);
end
$$;

create or replace function public.discovery_review(p_id uuid,p_reviewer text,p_input jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare c public.discovery_candidates%rowtype; act text := p_input->>'action'; v_draft jsonb; v_hash text;
begin
  if char_length(p_reviewer) not between 1 and 128 then raise exception 'invalid_input'; end if;
  select * into c from public.discovery_candidates where id=p_id for update;
  if not found then raise exception 'not_found'; end if;
  if c.draft_version is distinct from (p_input->>'version')::integer or c.draft_hash is distinct from p_input->>'hash' then raise exception 'stale_draft'; end if;
  if c.publication_status in ('pr_open','merged','site_live','verification_failed') then raise exception 'already_published'; end if;
  if act='approve' then
    if c.publication_status <> 'unreviewed' or c.research_status <> 'ready_for_review' or c.draft is null or
       c.draft_hash is null or jsonb_array_length(c.unresolved_claims) <> 0 then raise exception 'not_reviewable'; end if;
    update public.discovery_candidates set publication_status='approved',approved_by=p_reviewer,
      approved_at=now(),approved_hash=draft_hash,approved_version=draft_version,updated_at=now() where id=p_id;
  elsif act='edit' then
    v_draft := p_input->'draft';
    if v_draft is null or jsonb_typeof(v_draft) <> 'object' then raise exception 'invalid_input'; end if;
    v_hash := p_input->>'draft_hash';
    if v_hash is null or v_hash !~ '^[a-f0-9]{64}$' then raise exception 'invalid_input'; end if;
    update public.discovery_candidates set draft=v_draft,draft_hash=v_hash,draft_version=draft_version+1,
      publication_status='unreviewed',approved_at=null,approved_hash=null,approved_by=null,approved_version=null,
      research_status=case when jsonb_array_length(unresolved_claims)=0 then 'ready_for_review' else 'needs_evidence' end,
      updated_at=now() where id=p_id;
  elsif act in ('reject','needs_research') then
    update public.discovery_candidates set publication_status='unreviewed',approved_at=null,approved_hash=null,approved_by=null,approved_version=null,
      research_status=case when act='reject' then 'rejected' else 'needs_evidence' end,updated_at=now()
      where id=p_id;
  else raise exception 'invalid_input';
  end if;
  insert into public.discovery_review_events(candidate_id,actor,action,old_hash,new_hash,reason)
  values(p_id,p_reviewer,act,c.draft_hash,(select draft_hash from public.discovery_candidates where id=p_id),coalesce(p_input->>'reason',''));
  return public.discovery_candidate(p_id);
end
$$;

create or replace function public.discovery_worker(p_action text,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  r public.discovery_runs%rowtype; c public.discovery_candidates%rowtype;
  patch jsonb; receipt jsonb; output jsonb; v_reservation jsonb; v_key text;
  v_day integer; v_month integer; v_credits integer; v_replayed boolean := false;
begin
  if p_action='read_approved' then
    return jsonb_build_object('candidates',coalesce((select jsonb_agg(public.discovery_candidate(id)->'candidate')
      from public.discovery_candidates where publication_status='approved' and approved_hash=draft_hash and approved_version=draft_version),'[]'::jsonb));
  elsif p_action='read_publication' then
    return jsonb_build_object('candidates',coalesce((select jsonb_agg(public.discovery_candidate(publishing.id)->'candidate') from (
      select id from public.discovery_candidates where publication_status in ('pr_open','merged','verification_failed','site_live')
        and approved_hash=draft_hash and approved_version=draft_version
      order by (publication_status='site_live'),updated_at limit 100
    ) publishing),'[]'::jsonb));
  elsif p_action='read_pending' then
    return jsonb_build_object(
      'candidates',coalesce((select jsonb_agg(public.discovery_candidate(id)->'candidate') from (
        select id from public.discovery_candidates where publication_status='unreviewed' and research_status in ('discovered','hydrated','researching','needs_evidence','retryable_failed') order by updated_at limit 100
      ) pending),'[]'::jsonb),
      'runs',coalesce((select jsonb_agg(to_jsonb(rr)) from public.discovery_runs rr
        where grok_receipt->>'status' in ('sending','send_unknown','accepted','pending')),'[]'::jsonb));
  elsif p_action='begin_run' then
    perform pg_advisory_xact_lock(hashtext('discovery-run:' || (p_payload->>'run_key')));
    select * into r from public.discovery_runs where run_key=p_payload->>'run_key' for update;
    if found then
      v_replayed := true;
      if r.status='running' then
        if r.lease_expires_at>now() and r.lease_owner<>p_payload->>'lease_owner' then raise exception 'run_busy'; end if;
        update public.discovery_runs set lease_owner=p_payload->>'lease_owner',lease_expires_at=now()+interval '15 minutes' where id=r.id returning * into r;
      end if;
    else
      insert into public.discovery_runs(run_key,window_start,window_end,lease_owner)
      values(p_payload->>'run_key',(p_payload->>'window_start')::timestamptz,(p_payload->>'window_end')::timestamptz,p_payload->>'lease_owner') returning * into r;
    end if;
    return jsonb_build_object('run',to_jsonb(r),'replayed',v_replayed);
  elsif p_action in ('reserve_credits','settle_credits') then
    -- Serializes reservations across all runs so parallel tasks cannot race daily/monthly caps.
    perform pg_advisory_xact_lock(hashtext('discovery-credit-budget'));
    select * into r from public.discovery_runs where id=(p_payload->>'run_id')::uuid for update;
    if not found then raise exception 'not_found'; end if;
    v_key := p_payload->>'reservation_key';
    v_reservation := r.credit_reservations->v_key;
    v_replayed := v_reservation is not null;
    if p_action='reserve_credits' then
      v_credits := (p_payload->>'credits')::integer;
      if v_credits not between 1 and 12 then raise exception 'invalid_input'; end if;
      if v_replayed and (v_reservation->>'reserved')::integer <> v_credits then raise exception 'reservation_conflict'; end if;
    else
      if v_reservation is null then raise exception 'not_found'; end if;
      v_credits := (p_payload->>'charged_credits')::integer;
      if v_credits not between 0 and 1000 then raise exception 'invalid_input'; end if;
      if v_reservation->>'charged' is not null and (v_reservation->>'charged')::integer <> v_credits then raise exception 'reservation_conflict'; end if;
      v_reservation := v_reservation || jsonb_build_object('charged',v_credits,'settled_at',now());
      update public.discovery_runs set credit_reservations=jsonb_set(credit_reservations,array[v_key],v_reservation,true) where id=r.id;
    end if;
    select coalesce(sum(coalesce((q.value->>'charged')::integer,(q.value->>'reserved')::integer)),0)::integer into v_day
      from public.discovery_runs rr cross join lateral jsonb_each(rr.credit_reservations) q
      where ((q.value->>'reserved_at')::timestamptz at time zone 'UTC')::date=(now() at time zone 'UTC')::date;
    select coalesce(sum(coalesce((q.value->>'charged')::integer,(q.value->>'reserved')::integer)),0)::integer into v_month
      from public.discovery_runs rr cross join lateral jsonb_each(rr.credit_reservations) q
      where date_trunc('month',(q.value->>'reserved_at')::timestamptz at time zone 'UTC')=date_trunc('month',now() at time zone 'UTC');
    if p_action='reserve_credits' and not v_replayed then
      if v_day+v_credits>12 or v_month+v_credits>360 then
        return jsonb_build_object('allowed',false,'reserved',0,'reservation_key',v_key,'replayed',false,'charged_credits',null,'daily_remaining',greatest(0,12-v_day),'monthly_remaining',greatest(0,360-v_month));
      end if;
      v_reservation := jsonb_build_object('reserved',v_credits,'charged',null,'reserved_at',now());
      update public.discovery_runs set credit_reservations=jsonb_set(credit_reservations,array[v_key],v_reservation,true) where id=r.id;
      v_day:=v_day+v_credits; v_month:=v_month+v_credits;
    end if;
    return jsonb_build_object('allowed',true,'reserved',(v_reservation->>'reserved')::integer,'reservation_key',v_key,'replayed',v_replayed,
      'charged_credits',v_reservation->'charged','daily_remaining',greatest(0,12-v_day),'monthly_remaining',greatest(0,360-v_month));
  elsif p_action='reserve_grok' then
    -- A reserved attempt stays counted after failure or an ambiguous network result.
    perform pg_advisory_xact_lock(hashtext('discovery-grok-attempt-budget'));
    select * into r from public.discovery_runs where id=(p_payload->>'run_id')::uuid for update;
    if not found then raise exception 'not_found'; end if;
    v_key:=p_payload->>'reservation_key';
    if r.grok_reservations ? v_key then
      return jsonb_build_object('allowed',true,'replayed',true,'reservation_key',v_key);
    end if;
    select count(*)::integer into v_day from public.discovery_runs rr cross join lateral jsonb_each(rr.grok_reservations) q
      where ((q.value->>'reserved_at')::timestamptz at time zone 'UTC')::date=(now() at time zone 'UTC')::date;
    select count(*)::integer into v_month from public.discovery_runs rr cross join lateral jsonb_each(rr.grok_reservations) q
      where date_trunc('month',(q.value->>'reserved_at')::timestamptz at time zone 'UTC')=date_trunc('month',now() at time zone 'UTC');
    if v_day>=1 or v_month>=31 then return jsonb_build_object('allowed',false,'replayed',false,'reservation_key',v_key); end if;
    update public.discovery_runs set grok_reservations=jsonb_set(grok_reservations,array[v_key],jsonb_build_object('reserved_at',now()),true) where id=r.id;
    return jsonb_build_object('allowed',true,'replayed',false,'reservation_key',v_key);
  elsif p_action='ingest_grok_result' then
    select * into r from public.discovery_runs where grok_receipt->>'request_id'=p_payload->>'request_id' for update;
    if not found then raise exception 'not_found'; end if;
    if r.grok_receipt->>'status' in ('completed','failed') then
      if r.grok_receipt->>'result_hash' is distinct from p_payload->>'result_hash' then raise exception 'receipt_conflict'; end if;
      return jsonb_build_object('replayed',true,'candidates','[]'::jsonb,'run',to_jsonb(r));
    end if;
    output := public.discovery_ingest_items(coalesce(p_payload->'items','[]'));
    receipt := r.grok_receipt || jsonb_build_object('status',p_payload->>'status','result_hash',p_payload->>'result_hash','completed_at',now());
    if p_payload ? 'provider_run_id' then receipt:=receipt || jsonb_build_object('provider_run_id',p_payload->>'provider_run_id'); end if;
    update public.discovery_runs set grok_receipt=receipt,
      provider_status=provider_status || jsonb_build_object('grok',p_payload->>'status')
      where id=r.id returning * into r;
    return jsonb_build_object('replayed',false,'candidates',output,'run',to_jsonb(r));
  elsif p_action in ('mark_pr','mark_live') then
    select * into c from public.discovery_candidates where id=(p_payload->>'id')::uuid for update;
    if not found then raise exception 'not_found'; end if;
    if c.draft_version is distinct from (p_payload->>'version')::integer or c.draft_hash is distinct from p_payload->>'hash' or
       c.approved_hash is distinct from c.draft_hash or c.approved_version is distinct from c.draft_version then raise exception 'stale_draft'; end if;
    if p_action='mark_pr' then
      if c.publication_status='pr_open' and c.pr_url=p_payload->>'pr_url' and c.pr_head_sha=p_payload->>'pr_head_sha' then return public.discovery_candidate(c.id); end if;
      if c.publication_status<>'approved' then raise exception 'publication_conflict'; end if;
      update public.discovery_candidates set publication_status='pr_open',pr_url=p_payload->>'pr_url',pr_head_sha=p_payload->>'pr_head_sha',updated_at=now() where id=c.id;
    else
      if c.publication_status not in ('pr_open','merged','verification_failed','site_live') then raise exception 'publication_conflict'; end if;
      if c.publication_status='site_live' and c.merge_sha is distinct from p_payload->>'merge_sha' then raise exception 'publication_conflict'; end if;
      update public.discovery_candidates set publication_status='site_live',merge_sha=p_payload->>'merge_sha',
        verified_at=(p_payload->>'verified_at')::timestamptz,proof_urls=p_payload->'proof_urls',updated_at=now() where id=c.id;
    end if;
    insert into public.discovery_review_events(candidate_id,actor,action,old_hash,new_hash,metadata)
      values(c.id,'worker',p_action,c.draft_hash,c.draft_hash,p_payload - 'action');
    return public.discovery_candidate(c.id);
  end if;

  if p_action not in ('checkpoint','ingest','finish_run') then raise exception 'invalid_action'; end if;
  select * into r from public.discovery_runs where id=(p_payload->>'run_id')::uuid for update;
  if not found then raise exception 'not_found'; end if;
  if r.status<>'running' or r.lease_owner is distinct from p_payload->>'lease_owner' or r.lease_expires_at<now() then raise exception 'lease_expired'; end if;
  if p_action='checkpoint' then
    patch := p_payload->'patch';
    receipt := coalesce(patch->'grok_receipt',r.grok_receipt);
    if patch ? 'grok_receipt' and receipt->>'status' in ('completed','failed') then raise exception 'invalid_action'; end if;
    if r.grok_receipt is not null and receipt->>'request_id' is distinct from r.grok_receipt->>'request_id' then raise exception 'receipt_conflict'; end if;
    if r.grok_receipt->>'provider' is not null and receipt->>'provider' is distinct from r.grok_receipt->>'provider' then raise exception 'receipt_conflict'; end if;
    if r.grok_receipt->>'status' in ('completed','failed') and receipt is distinct from r.grok_receipt then raise exception 'receipt_conflict'; end if;
    update public.discovery_runs set
      provider_status=provider_status || coalesce(patch->'provider_status','{}'),
      checkpoints=checkpoints || coalesce(patch->'checkpoints','{}'),
      grok_receipt=receipt,coverage_notes=coalesce(patch->'coverage_notes',coverage_notes),
      lease_expires_at=now()+interval '15 minutes'
      where id=r.id returning * into r;
    return jsonb_build_object('run',to_jsonb(r));
  elsif p_action='ingest' then
    return jsonb_build_object('candidates',public.discovery_ingest_items(p_payload->'items'));
  else
    update public.discovery_runs set status=p_payload->>'status',finished_at=now(),
      coverage_notes=coalesce(p_payload->'coverage_notes',coverage_notes),error_code=p_payload->>'error_code'
      where id=r.id returning * into r;
    return jsonb_build_object('run',to_jsonb(r));
  end if;
end
$$;

-- Explicit function grants: PostgreSQL grants PUBLIC EXECUTE on newly created functions.
revoke all on function public.discovery_candidate(uuid), public.discovery_inbox(),
  public.discovery_ingest_items(jsonb), public.discovery_intake(text,text),
  public.discovery_review(uuid,text,jsonb), public.discovery_worker(text,jsonb) from public, anon, authenticated;
grant execute on function public.discovery_candidate(uuid), public.discovery_inbox(),
  public.discovery_ingest_items(jsonb), public.discovery_intake(text,text),
  public.discovery_review(uuid,text,jsonb), public.discovery_worker(text,jsonb) to service_role;
