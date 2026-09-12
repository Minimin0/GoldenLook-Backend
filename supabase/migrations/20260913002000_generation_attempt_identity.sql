alter table public.cases
  add column if not exists generation_attempt_id uuid;

alter table public.cases drop constraint if exists cases_age_check;
alter table public.cases add constraint cases_age_check check (age between 1 and 120);

create index if not exists cases_created_at_idx on public.cases(created_at);

revoke all on table public.cases from anon, authenticated;
revoke all on table public.ai_generation_usage from anon, authenticated;
revoke all on table public.storage_deletion_failures from anon, authenticated;
revoke all on sequence public.storage_deletion_failures_id_seq from anon, authenticated;

drop function if exists public.begin_case_generation(uuid, uuid, integer);
drop function if exists public.finish_case_generation(uuid, uuid, text);
drop function if exists public.abort_case_generation(uuid, uuid);

create function public.begin_case_generation(
  p_case_id uuid,
  p_user_id uuid,
  p_daily_limit integer
)
returns table(attempt_id uuid, is_regeneration boolean, regeneration_count integer, previous_generated_path text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_case public.cases%rowtype;
  today_count integer;
begin
  select * into current_case
  from public.cases
  where id = p_case_id and user_id = p_user_id
  for update;

  if not found then raise exception 'case_not_found'; end if;
  if current_case.published_at is not null then raise exception 'case_published'; end if;
  if current_case.generation_status = 'GENERATING'
    and current_case.generation_started_at > now() - interval '15 minutes' then
    raise exception 'generation_in_progress';
  end if;
  if current_case.generated_path is not null and current_case.regeneration_count >= 3 then
    raise exception 'generation_limit';
  end if;

  insert into public.ai_generation_usage(user_id, used_on, count)
  values (p_user_id, current_date, 0)
  on conflict (user_id, used_on) do nothing;

  select count into today_count
  from public.ai_generation_usage
  where user_id = p_user_id and used_on = current_date
  for update;

  if today_count >= p_daily_limit then raise exception 'daily_generation_limit'; end if;

  update public.ai_generation_usage
  set count = count + 1
  where user_id = p_user_id and used_on = current_date;

  attempt_id := gen_random_uuid();
  update public.cases
  set generation_status = 'GENERATING',
      generation_started_at = now(),
      generation_attempt_id = attempt_id
  where id = p_case_id;

  is_regeneration := current_case.generated_path is not null;
  regeneration_count := current_case.regeneration_count;
  previous_generated_path := current_case.generated_path;
  return next;
end;
$$;

create function public.finish_case_generation(
  p_case_id uuid,
  p_user_id uuid,
  p_attempt_id uuid,
  p_generated_path text
)
returns table(generation_status text, regeneration_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_case public.cases%rowtype;
begin
  select * into current_case
  from public.cases
  where id = p_case_id and user_id = p_user_id
  for update;

  if not found then raise exception 'case_not_found'; end if;
  if current_case.generation_attempt_id is distinct from p_attempt_id then raise exception 'stale_generation_attempt'; end if;
  if current_case.published_at is not null then raise exception 'case_published'; end if;
  if current_case.generation_status <> 'GENERATING' then raise exception 'invalid_generation_state'; end if;
  if current_case.generated_path is not null and current_case.regeneration_count >= 3 then raise exception 'generation_limit'; end if;

  update public.cases
  set generated_path = p_generated_path,
      generation_status = 'GENERATED',
      generation_started_at = null,
      generation_attempt_id = null,
      regeneration_count = case
        when current_case.generated_path is null then current_case.regeneration_count
        else current_case.regeneration_count + 1
      end
  where id = p_case_id
  returning cases.generation_status, cases.regeneration_count
  into generation_status, regeneration_count;

  return next;
end;
$$;

create function public.abort_case_generation(
  p_case_id uuid,
  p_user_id uuid,
  p_attempt_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_case public.cases%rowtype;
begin
  select * into current_case
  from public.cases
  where id = p_case_id and user_id = p_user_id
  for update;

  if not found then raise exception 'case_not_found'; end if;
  if current_case.generation_attempt_id is distinct from p_attempt_id then raise exception 'stale_generation_attempt'; end if;
  if current_case.generation_status <> 'GENERATING' then raise exception 'invalid_generation_state'; end if;

  update public.cases
  set generation_status = case when generated_path is null then 'TEMPORARY_ERROR' else 'GENERATED' end,
      generation_started_at = null,
      generation_attempt_id = null
  where id = p_case_id;
end;
$$;

create function public.publish_case(
  p_case_id uuid,
  p_user_id uuid,
  p_share_id text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_case public.cases%rowtype;
begin
  select * into current_case
  from public.cases
  where id = p_case_id and user_id = p_user_id
  for update;

  if not found then raise exception 'case_not_found'; end if;
  if current_case.published_at is not null then return current_case.share_id; end if;
  if current_case.generation_status <> 'GENERATED'
    or current_case.generated_path is null
    or current_case.name is null
    or current_case.age is null
    or current_case.missing_at is null
    or current_case.place is null
    or current_case.contact is null
    or current_case.contact !~ '^\+?[0-9 ()-]+$'
    or length(regexp_replace(current_case.contact, '\D', '', 'g')) not between 7 and 15
    or not current_case.contact_disclosure_consent then
    raise exception 'publish_invalid';
  end if;

  update public.cases
  set share_id = p_share_id, published_at = now()
  where id = p_case_id;
  return p_share_id;
end;
$$;

revoke all on function public.begin_case_generation(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.finish_case_generation(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.abort_case_generation(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.publish_case(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.begin_case_generation(uuid, uuid, integer) to service_role;
grant execute on function public.finish_case_generation(uuid, uuid, uuid, text) to service_role;
grant execute on function public.abort_case_generation(uuid, uuid, uuid) to service_role;
grant execute on function public.publish_case(uuid, uuid, text) to service_role;
