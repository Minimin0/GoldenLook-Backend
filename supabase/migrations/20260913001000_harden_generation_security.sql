alter table public.cases
  add column if not exists generation_started_at timestamptz;

create table if not exists public.ai_generation_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  used_on date not null default current_date,
  count integer not null default 0 check (count >= 0),
  primary key (user_id, used_on)
);

alter table public.ai_generation_usage enable row level security;

create table if not exists public.storage_deletion_failures (
  id bigserial primary key,
  bucket text not null,
  path text not null,
  created_at timestamptz not null default now()
);

alter table public.storage_deletion_failures enable row level security;

create or replace function public.begin_case_generation(
  p_case_id uuid,
  p_user_id uuid,
  p_daily_limit integer
)
returns table(is_regeneration boolean, regeneration_count integer, previous_generated_path text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_case public.cases%rowtype;
  today_count integer;
begin
  select * into current_case
  from public.cases
  where id = p_case_id and user_id = p_user_id
  for update;

  if not found then
    raise exception 'case_not_found';
  end if;

  if current_case.published_at is not null then
    raise exception 'case_published';
  end if;

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

  if today_count >= p_daily_limit then
    raise exception 'daily_generation_limit';
  end if;

  update public.ai_generation_usage
  set count = count + 1
  where user_id = p_user_id and used_on = current_date;

  update public.cases
  set generation_status = 'GENERATING',
      generation_started_at = now()
  where id = p_case_id;

  is_regeneration := current_case.generated_path is not null;
  regeneration_count := current_case.regeneration_count;
  previous_generated_path := current_case.generated_path;
  return next;
end;
$$;

create or replace function public.finish_case_generation(
  p_case_id uuid,
  p_user_id uuid,
  p_generated_path text
)
returns table(generation_status text, regeneration_count integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_case public.cases%rowtype;
begin
  select * into current_case
  from public.cases
  where id = p_case_id and user_id = p_user_id
  for update;

  if not found then
    raise exception 'case_not_found';
  end if;

  if current_case.published_at is not null then
    raise exception 'case_published';
  end if;

  if current_case.generation_status <> 'GENERATING' then
    raise exception 'invalid_generation_state';
  end if;

  if current_case.generated_path is not null and current_case.regeneration_count >= 3 then
    raise exception 'generation_limit';
  end if;

  update public.cases
  set generated_path = p_generated_path,
      generation_status = 'GENERATED',
      generation_started_at = null,
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

create or replace function public.abort_case_generation(
  p_case_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.cases
  set generation_status = case when generated_path is null then 'TEMPORARY_ERROR' else 'GENERATED' end,
      generation_started_at = null
  where id = p_case_id and user_id = p_user_id and generation_status = 'GENERATING';
end;
$$;

revoke all on function public.begin_case_generation(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.finish_case_generation(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.abort_case_generation(uuid, uuid) from public, anon, authenticated;
grant execute on function public.begin_case_generation(uuid, uuid, integer) to service_role;
grant execute on function public.finish_case_generation(uuid, uuid, text) to service_role;
grant execute on function public.abort_case_generation(uuid, uuid) to service_role;
