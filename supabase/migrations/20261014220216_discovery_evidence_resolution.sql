-- Explicit human evidence resolution, retaining the original private service-only boundary.
-- Existing migration history is immutable; this replaces only the review RPC.
create or replace function public.discovery_review(p_id uuid,p_reviewer text,p_input jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  c public.discovery_candidates%rowtype; act text := p_input->>'action';
  v_draft jsonb; v_hash text; v_resolutions jsonb; v_resolution jsonb;
  v_claims jsonb := '[]'::jsonb; v_remaining jsonb; v_metadata jsonb := '{}'::jsonb;
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
    -- Hash is computed from the validated draft by the server, never accepted from HTTP clients.
    v_hash := p_input->>'draft_hash';
    if v_hash is null or v_hash !~ '^[a-f0-9]{64}$' then raise exception 'invalid_input'; end if;
    v_resolutions := coalesce(p_input->'resolved_claims','[]'::jsonb);
    if jsonb_typeof(v_resolutions) <> 'array' then raise exception 'invalid_resolution'; end if;
    if jsonb_array_length(v_resolutions)>10 then raise exception 'invalid_resolution'; end if;
    v_metadata := jsonb_build_object('resolved_claims',v_resolutions);
    if octet_length(v_metadata::text)>8000 or pg_column_size(v_metadata)>8000 then raise exception 'invalid_resolution'; end if;
    for v_resolution in select value from jsonb_array_elements(v_resolutions) loop
      if jsonb_typeof(v_resolution) <> 'object' then raise exception 'invalid_resolution'; end if;
      if (select count(*) from jsonb_object_keys(v_resolution))<>3 or
         not (v_resolution ?& array['claim','source_url','note']) or
         jsonb_typeof(v_resolution->'claim')<>'string' or jsonb_typeof(v_resolution->'source_url')<>'string' or
         jsonb_typeof(v_resolution->'note')<>'string' then raise exception 'invalid_resolution'; end if;
      if char_length(v_resolution->>'claim') not between 1 and 600 or
         char_length(v_resolution->>'source_url') not between 1 and 2048 or
         char_length(btrim(v_resolution->>'note')) not between 20 and 600 or
         not (c.unresolved_claims ? (v_resolution->>'claim')) or v_claims ? (v_resolution->>'claim') then raise exception 'invalid_resolution'; end if;
      if v_resolution->>'source_url' !~ '^https://[^/@:[:space:]]+\.[^/@:[:space:]]+([/?#]|$)' then raise exception 'invalid_resolution'; end if;
      if jsonb_typeof(v_draft->'sources') is distinct from 'array' then raise exception 'invalid_resolution'; end if;
      if not exists(select 1 from jsonb_array_elements(v_draft->'sources') s where s->>'url'=v_resolution->>'source_url') then raise exception 'invalid_resolution'; end if;
      v_claims := v_claims || jsonb_build_array(v_resolution->>'claim');
    end loop;
    select coalesce(jsonb_agg(claim.value order by claim.ordinality),'[]'::jsonb) into v_remaining
      from jsonb_array_elements(c.unresolved_claims) with ordinality claim(value,ordinality)
      where not (v_claims ? (claim.value #>> '{}'));
    update public.discovery_candidates set draft=v_draft,draft_hash=v_hash,draft_version=draft_version+1,
      unresolved_claims=v_remaining,
      publication_status='unreviewed',approved_at=null,approved_hash=null,approved_by=null,approved_version=null,
      research_status=case when jsonb_array_length(v_remaining)=0 then 'ready_for_review' else 'needs_evidence' end,
      updated_at=now() where id=p_id;
  elsif act in ('reject','needs_research') then
    update public.discovery_candidates set publication_status='unreviewed',approved_at=null,approved_hash=null,approved_by=null,approved_version=null,
      research_status=case when act='reject' then 'rejected' else 'researching' end,
      draft_version=draft_version+case when act='needs_research' then 1 else 0 end,updated_at=now()
      where id=p_id;
  else raise exception 'invalid_input';
  end if;
  insert into public.discovery_review_events(candidate_id,actor,action,old_hash,new_hash,reason,metadata)
  values(p_id,p_reviewer,act,c.draft_hash,(select draft_hash from public.discovery_candidates where id=p_id),coalesce(p_input->>'reason',''),v_metadata);
  return public.discovery_candidate(p_id);
end
$$;

revoke all on function public.discovery_review(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.discovery_review(uuid,text,jsonb) to service_role;
