create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  share_id text unique,
  photo_mode text not null check (photo_mode in ('body_visible', 'face_only')),
  appearance jsonb not null default '{}'::jsonb,
  body_profile jsonb,
  original_path text,
  generated_path text,
  generation_status text not null default 'PENDING' check (generation_status in ('PENDING', 'GENERATING', 'GENERATED', 'TEMPORARY_ERROR')),
  regeneration_count integer not null default 0 check (regeneration_count between 0 and 3),
  name text,
  age integer check (age between 0 and 120),
  height_cm integer check (height_cm between 40 and 230),
  missing_at text,
  place text,
  contact text,
  notes text,
  contact_disclosure_consent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create index if not exists cases_user_id_idx on public.cases(user_id);
create index if not exists cases_share_id_idx on public.cases(share_id) where share_id is not null;

alter table public.cases enable row level security;

drop policy if exists "cases owner select" on public.cases;
drop policy if exists "cases owner insert" on public.cases;
drop policy if exists "cases owner update" on public.cases;
drop policy if exists "cases owner delete" on public.cases;

create policy "cases owner select" on public.cases for select using (auth.uid() = user_id);
create policy "cases owner insert" on public.cases for insert with check (auth.uid() = user_id);
create policy "cases owner update" on public.cases for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "cases owner delete" on public.cases for delete using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('case-images', 'case-images', false)
on conflict (id) do update set public = false;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists cases_touch_updated_at on public.cases;
create trigger cases_touch_updated_at
before update on public.cases
for each row execute function public.touch_updated_at();

create or replace function public.finish_case_generation(
  p_case_id uuid,
  p_user_id uuid,
  p_generated_path text
)
returns table(generation_status text, regeneration_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_case public.cases%rowtype;
begin
  select * into current_case
  from public.cases
  where id = p_case_id and user_id = p_user_id
  for update;

  if not found then
    raise exception 'case not found';
  end if;

  if current_case.generated_path is not null and current_case.regeneration_count >= 3 then
    raise exception 'generation limit';
  end if;

  update public.cases
  set generated_path = p_generated_path,
      generation_status = 'GENERATED',
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
