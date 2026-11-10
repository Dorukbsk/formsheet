-- ============================================================
-- AthletiX: coach teams + delete account
-- Run ONCE in Supabase: SQL Editor > New query > paste all > Run.
-- Safe to run again (it skips or replaces what already exists).
-- ============================================================

-- 0. Safety check: stop with a clear message if the matches table isn't as expected.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sessions' and column_name = 'user_id'
  ) then
    raise exception 'AthletiX setup stopped: table public.sessions with a user_id column was not found. Nothing was changed.';
  end if;
end $$;

-- 1. Tables
create table if not exists public.teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 60),
  sport       text not null check (sport in ('football', 'basketball', 'volleyball')),
  coach_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  coach_name  text not null default '' check (char_length(coach_name) <= 60),
  created_at  timestamptz not null default now()
);

-- The join code lives in its own table so only the coach can ever read it.
create table if not exists public.team_codes (
  team_id  uuid primary key references public.teams (id) on delete cascade,
  code     text not null unique
);

create table if not exists public.team_members (
  team_id       uuid not null references public.teams (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  display_name  text not null check (char_length(display_name) between 1 and 60),
  joined_at     timestamptz not null default now(),
  primary key (team_id, user_id)
);

create index if not exists team_members_user_idx on public.team_members (user_id);
create index if not exists teams_coach_idx on public.teams (coach_id);
create index if not exists sessions_user_id_idx on public.sessions (user_id);

alter table public.teams enable row level security;
alter table public.team_codes enable row level security;
alter table public.team_members enable row level security;

-- 2. Helper checks (run with owner rights so policies don't loop into each other)
create or replace function public.is_team_coach(t uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.teams where id = t and coach_id = auth.uid());
$$;

create or replace function public.is_team_member(t uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.team_members where team_id = t and user_id = auth.uid());
$$;

-- true when the logged-in user coaches a team that `player` belongs to, in `sport_key`
create or replace function public.coaches_player(player uuid, sport_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.team_members m
    join public.teams t on t.id = m.team_id
    where m.user_id = player and t.coach_id = auth.uid() and t.sport = sport_key
  );
$$;

-- 3. Who can see and change what
--    teams: the coach and the team's players can read it; only the coach can delete it.
--    Nobody can edit a team after creating it (so a coach can't switch its sport and see other matches).
drop policy if exists "teams_read" on public.teams;
create policy "teams_read" on public.teams for select to authenticated
  using (coach_id = (select auth.uid()) or public.is_team_member(id));

drop policy if exists "teams_update" on public.teams;

drop policy if exists "teams_delete" on public.teams;
create policy "teams_delete" on public.teams for delete to authenticated
  using (coach_id = (select auth.uid()));
-- (no insert policy: teams are created only through create_team below)

--    team_codes: only the coach can read the code.
drop policy if exists "codes_read" on public.team_codes;
create policy "codes_read" on public.team_codes for select to authenticated
  using (public.is_team_coach(team_id));

--    team_members: a player sees only their own membership; the coach sees the whole team.
--    A player can leave. Joining and removing go through the functions below.
drop policy if exists "members_read" on public.team_members;
create policy "members_read" on public.team_members for select to authenticated
  using (user_id = (select auth.uid()) or public.is_team_coach(team_id));

drop policy if exists "members_delete" on public.team_members;
create policy "members_delete" on public.team_members for delete to authenticated
  using (user_id = (select auth.uid()));

--    sessions (matches): a coach can READ the matches of their players, only in the team's sport.
--    Players' own-rows policy stays exactly as it is.
drop policy if exists "coach_reads_team_matches" on public.sessions;
create policy "coach_reads_team_matches" on public.sessions for select to authenticated
  using (public.coaches_player(user_id, payload ->> 'sport'));

-- 4. Actions the app calls
create or replace function public.new_team_code()
returns text language plpgsql security definer set search_path = public as $$
declare
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';  -- no 0/O, 1/I/L
  c text;
begin
  loop
    c := '';
    for i in 1..6 loop
      c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.team_codes where code = c);
  end loop;
  return c;
end;
$$;

create or replace function public.create_team(p_name text, p_sport text, p_coach_name text)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  c text;
  r public.teams;
begin
  if uid is null then raise exception 'Not logged in'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Team name is required'; end if;
  if p_sport is null or p_sport not in ('football', 'basketball', 'volleyball') then raise exception 'Unknown sport'; end if;
  if (select count(*) from public.teams where coach_id = uid) >= 20 then
    raise exception 'Team limit reached';
  end if;
  insert into public.teams (name, sport, coach_id, coach_name)
  values (left(trim(p_name), 60), p_sport, uid, left(coalesce(trim(p_coach_name), ''), 60))
  returning * into r;
  c := public.new_team_code();
  insert into public.team_codes (team_id, code) values (r.id, c);
  return json_build_object('id', r.id, 'name', r.name, 'sport', r.sport, 'code', c,
                           'coach_name', r.coach_name, 'created_at', r.created_at);
end;
$$;

-- Coach only: replace the team's code (old code stops working straight away).
create or replace function public.rotate_team_code(p_team uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  c text;
begin
  if not public.is_team_coach(p_team) then raise exception 'Only the coach can do that'; end if;
  c := public.new_team_code();
  update public.team_codes set code = c where team_id = p_team;
  return c;
end;
$$;

create or replace function public.join_team(p_code text, p_name text)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  r public.teams;
begin
  if uid is null then raise exception 'Not logged in'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Your name is required'; end if;
  select t.* into r from public.teams t join public.team_codes k on k.team_id = t.id
  where k.code = upper(trim(coalesce(p_code, '')));
  if not found then raise exception 'No team with that code'; end if;
  if r.coach_id = uid then raise exception 'You coach this team'; end if;
  insert into public.team_members (team_id, user_id, display_name)
  values (r.id, uid, left(trim(p_name), 60))
  on conflict (team_id, user_id) do update set display_name = excluded.display_name;
  return json_build_object('id', r.id, 'name', r.name, 'sport', r.sport, 'coach_name', r.coach_name);
end;
$$;

-- Coach only: remove a player. (Anyone with the code can join again; to keep someone out, make a new code.)
create or replace function public.remove_player(p_team uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_team_coach(p_team) then raise exception 'Only the coach can do that'; end if;
  delete from public.team_members where team_id = p_team and user_id = p_user;
  if not found then raise exception 'Player not found'; end if;
end;
$$;

-- Deletes everything about the logged-in user, then the login itself.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not logged in'; end if;
  delete from public.team_members where user_id = uid;
  delete from public.teams where coach_id = uid;
  delete from public.sessions where user_id = uid;
  delete from public.plans where user_id = uid;
  delete from auth.users where id = uid;
end;
$$;

-- 5. Permissions: only logged-in users, and only what the app needs
revoke all on public.teams, public.team_codes, public.team_members from public, anon, authenticated;
grant select, delete on public.teams to authenticated;
grant select on public.team_codes to authenticated;
grant select, delete on public.team_members to authenticated;

revoke execute on function public.new_team_code() from public, anon, authenticated;
revoke execute on function public.create_team(text, text, text) from public, anon;
revoke execute on function public.rotate_team_code(uuid) from public, anon;
revoke execute on function public.join_team(text, text) from public, anon;
revoke execute on function public.remove_player(uuid, uuid) from public, anon;
revoke execute on function public.delete_my_account() from public, anon;
revoke execute on function public.is_team_coach(uuid) from public, anon;
revoke execute on function public.is_team_member(uuid) from public, anon;
revoke execute on function public.coaches_player(uuid, text) from public, anon;
grant execute on function public.create_team(text, text, text) to authenticated;
grant execute on function public.rotate_team_code(uuid) to authenticated;
grant execute on function public.join_team(text, text) to authenticated;
grant execute on function public.remove_player(uuid, uuid) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.is_team_coach(uuid) to authenticated;
grant execute on function public.is_team_member(uuid) to authenticated;
grant execute on function public.coaches_player(uuid, text) to authenticated;
