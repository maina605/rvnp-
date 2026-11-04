create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('trainee', 'trainer')),
  full_name text not null check (length(trim(full_name)) between 1 and 120),
  admission_number text,
  trainer_id text,
  course text not null check (length(trim(course)) between 1 and 120),
  is_approved boolean not null default false,
  created_at timestamptz not null default now(),
  constraint profiles_role_identifier_check check (
    (role = 'trainee' and admission_number is not null and trainer_id is null)
    or (role = 'trainer' and trainer_id is not null and admission_number is null)
  )
);

create unique index if not exists profiles_admission_number_unique
  on public.profiles (lower(admission_number))
  where admission_number is not null;

create unique index if not exists profiles_trainer_id_unique
  on public.profiles (lower(trainer_id))
  where trainer_id is not null;

create table if not exists public.profile_contacts (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  phone text not null check (length(trim(phone)) between 1 and 30)
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  trainee_id uuid not null references public.profiles (id) on delete cascade,
  marked_by uuid not null references public.profiles (id) on delete restrict,
  unit_name text not null check (length(trim(unit_name)) between 1 and 100),
  status text not null check (status in ('Present', 'Absent', 'Late')),
  recorded_at timestamptz not null default now()
);

create index if not exists attendance_trainee_recorded_at_idx
  on public.attendance (trainee_id, recorded_at desc);

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_role text;
  new_name text;
  new_phone text;
  new_course text;
  new_admission_number text;
  new_trainer_id text;
begin
  new_role := coalesce(new.raw_user_meta_data ->> 'role', '');
  new_name := trim(coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  new_phone := trim(coalesce(new.raw_user_meta_data ->> 'phone', ''));
  new_course := trim(coalesce(new.raw_user_meta_data ->> 'course', ''));
  new_admission_number := nullif(trim(coalesce(new.raw_user_meta_data ->> 'admission_number', '')), '');
  new_trainer_id := nullif(trim(coalesce(new.raw_user_meta_data ->> 'trainer_id', '')), '');

  if new_role not in ('trainee', 'trainer')
    or new_name = ''
    or new_phone = ''
    or new_course = ''
    or (new_role = 'trainee' and new_admission_number is null)
    or (new_role = 'trainer' and new_trainer_id is null) then
    raise exception 'Required RVNP profile details are missing or invalid';
  end if;

  insert into public.profiles (
    id, role, full_name, admission_number, trainer_id, course, is_approved
  ) values (
    new.id,
    new_role,
    new_name,
    case when new_role = 'trainee' then new_admission_number else null end,
    case when new_role = 'trainer' then new_trainer_id else null end,
    new_course,
    false
  );

  insert into public.profile_contacts (user_id, phone)
  values (new.id, new_phone);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_rvnp_profile on auth.users;
create trigger on_auth_user_created_rvnp_profile
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

create or replace function public.trainer_can_access_course(target_course text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles trainer
    where trainer.id = auth.uid()
      and trainer.role = 'trainer'
      and trainer.is_approved
      and lower(trim(trainer.course)) = lower(trim(target_course))
  );
$$;

create or replace function public.trainer_can_access_trainee(target_trainee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles trainer
    join public.profiles trainee
      on lower(trim(trainer.course)) = lower(trim(trainee.course))
    where trainer.id = auth.uid()
      and trainer.role = 'trainer'
      and trainer.is_approved
      and trainee.id = target_trainee_id
      and trainee.role = 'trainee'
  );
$$;

create or replace function public.current_user_is_trainee()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid() and role = 'trainee'
  );
$$;

alter table public.profiles enable row level security;
alter table public.profile_contacts enable row level security;
alter table public.attendance enable row level security;

revoke all on public.profiles, public.profile_contacts, public.attendance from anon, authenticated;
grant select on public.profiles, public.attendance to authenticated;
grant select on public.profile_contacts to authenticated;
grant insert (trainee_id, marked_by, unit_name, status) on public.attendance to authenticated;

drop policy if exists "Users read own contact details" on public.profile_contacts;
create policy "Users read own contact details"
  on public.profile_contacts for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users read own or course trainee profiles" on public.profiles;
create policy "Users read own or course trainee profiles"
  on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or (
      role = 'trainee'
      and public.trainer_can_access_course(course)
    )
  );

drop policy if exists "Users read own or course attendance" on public.attendance;
create policy "Users read own or course attendance"
  on public.attendance for select to authenticated
  using (
    trainee_id = auth.uid()
    or public.trainer_can_access_trainee(trainee_id)
  );

drop policy if exists "Trainees and approved trainers record attendance" on public.attendance;
create policy "Trainees and approved trainers record attendance"
  on public.attendance for insert to authenticated
  with check (
    (
      trainee_id = auth.uid()
      and marked_by = auth.uid()
      and public.current_user_is_trainee()
    )
    or (
      marked_by = auth.uid()
      and public.trainer_can_access_trainee(trainee_id)
    )
  );

revoke all on function public.create_profile_for_new_user() from public, anon, authenticated;
revoke all on function public.trainer_can_access_course(text) from public, anon;
revoke all on function public.trainer_can_access_trainee(uuid) from public, anon;
revoke all on function public.current_user_is_trainee() from public, anon;
grant execute on function public.trainer_can_access_course(text) to authenticated;
grant execute on function public.trainer_can_access_trainee(uuid) to authenticated;
grant execute on function public.current_user_is_trainee() to authenticated;

-- After registering a trainer and confirming their email, approve them from the
-- Supabase SQL Editor using their trainer ID:
-- update public.profiles set is_approved = true
-- where role = 'trainer' and trainer_id = 'TRAINER_ID_HERE';
