-- Pixel Obby optional cloud save and run history
-- Run once in the Supabase SQL editor for project kws...quup.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.game_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  save_data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.obby_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  obby_number integer not null check (obby_number > 0),
  completed_at timestamptz not null default now(),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  attempts integer check (attempts is null or attempts > 0),
  xp_earned integer not null default 0 check (xp_earned >= 0),
  replay boolean not null default false,
  skin text,
  equipped jsonb not null default '{}'::jsonb
);

create index if not exists obby_runs_user_completed_idx
  on public.obby_runs (user_id, completed_at desc);

alter table public.profiles enable row level security;
alter table public.game_progress enable row level security;
alter table public.obby_runs enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "progress_select_own" on public.game_progress;
create policy "progress_select_own" on public.game_progress
  for select using (auth.uid() = user_id);

drop policy if exists "progress_insert_own" on public.game_progress;
create policy "progress_insert_own" on public.game_progress
  for insert with check (auth.uid() = user_id);

drop policy if exists "progress_update_own" on public.game_progress;
create policy "progress_update_own" on public.game_progress
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "progress_delete_own" on public.game_progress;
create policy "progress_delete_own" on public.game_progress
  for delete using (auth.uid() = user_id);

drop policy if exists "runs_select_own" on public.obby_runs;
create policy "runs_select_own" on public.obby_runs
  for select using (auth.uid() = user_id);

drop policy if exists "runs_insert_own" on public.obby_runs;
create policy "runs_insert_own" on public.obby_runs
  for insert with check (auth.uid() = user_id);

drop policy if exists "runs_delete_own" on public.obby_runs;
create policy "runs_delete_own" on public.obby_runs
  for delete using (auth.uid() = user_id);

create or replace function public.handle_pixel_obby_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_pixel_obby_user_created on auth.users;
create trigger on_pixel_obby_user_created
  after insert on auth.users
  for each row execute procedure public.handle_pixel_obby_user();

create or replace function public.delete_pixel_obby_account()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_pixel_obby_account() from public;
grant execute on function public.delete_pixel_obby_account() to authenticated;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.game_progress to authenticated;
grant select, insert, delete on public.obby_runs to authenticated;
