alter table public.game_sessions add column if not exists session_number integer;

with numbered_sessions as (
  select
    id,
    row_number() over (partition by campaign_id order by started_at asc, id asc) as next_number
  from public.game_sessions
)
update public.game_sessions gs
set session_number = numbered_sessions.next_number
from numbered_sessions
where gs.id = numbered_sessions.id
  and gs.session_number is null;

update public.game_sessions
set label = 'Session ' || session_number::text
where session_number is not null
  and label !~ '^Session [0-9]+$';

with ranked_active_sessions as (
  select
    id,
    row_number() over (partition by campaign_id order by started_at desc, id desc) as active_rank
  from public.game_sessions
  where status = 'active'
)
update public.game_sessions gs
set status = 'closed',
    ended_at = coalesce(gs.ended_at, now())
from ranked_active_sessions ranked
where gs.id = ranked.id
  and ranked.active_rank > 1;

create unique index if not exists game_sessions_campaign_session_number_uidx
  on public.game_sessions (campaign_id, session_number);

create unique index if not exists game_sessions_one_active_per_campaign_uidx
  on public.game_sessions (campaign_id)
  where status = 'active';

create table if not exists public.session_attendees (
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('dm', 'player')),
  display_name text not null default '',
  selected_character_id text,
  joined_at timestamptz not null default now(),
  added_by_user_id uuid references auth.users(id) on delete set null,
  primary key (session_id, user_id)
);

create index if not exists session_attendees_user_idx
  on public.session_attendees (user_id, session_id);

insert into public.session_attendees (
  session_id,
  user_id,
  role,
  display_name,
  selected_character_id,
  added_by_user_id
)
select distinct
  sc.session_id,
  sc.owner_user_id,
  sc.owner_role,
  sc.display_name,
  sc.character_id,
  sc.owner_user_id
from public.session_characters sc
where sc.owner_user_id is not null
on conflict (session_id, user_id) do update
set selected_character_id = excluded.selected_character_id,
    display_name = excluded.display_name;

alter table public.session_attendees enable row level security;

drop policy if exists session_attendees_member_select on public.session_attendees;
drop policy if exists session_attendees_member_insert on public.session_attendees;
drop policy if exists session_attendees_member_update on public.session_attendees;
drop policy if exists session_attendees_dm_delete on public.session_attendees;

create policy session_attendees_member_select
  on public.session_attendees for select to authenticated
  using (public.is_session_member(session_id));

create policy session_attendees_member_insert
  on public.session_attendees for insert to authenticated
  with check (
    public.is_session_dm(session_id)
    or (
      user_id = auth.uid()
      and public.is_session_member(session_id)
    )
  );

create policy session_attendees_member_update
  on public.session_attendees for update to authenticated
  using (
    public.is_session_dm(session_id)
    or user_id = auth.uid()
  )
  with check (
    public.is_session_dm(session_id)
    or user_id = auth.uid()
  );

create policy session_attendees_dm_delete
  on public.session_attendees for delete to authenticated
  using (public.is_session_dm(session_id));

create or replace function public.start_current_game_session(p_campaign_id uuid)
returns public.game_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  current_session public.game_sessions%rowtype;
  next_session_number integer;
begin
  if not public.is_campaign_dm(p_campaign_id) then
    raise exception 'Only a campaign DM can start a session.';
  end if;

  select *
  into current_session
  from public.game_sessions
  where campaign_id = p_campaign_id
    and status = 'active'
  order by started_at desc
  limit 1;

  if found then
    return current_session;
  end if;

  select coalesce(max(session_number), 0) + 1
  into next_session_number
  from public.game_sessions
  where campaign_id = p_campaign_id;

  insert into public.game_sessions (
    campaign_id,
    label,
    status,
    created_by,
    session_number
  )
  values (
    p_campaign_id,
    'Session ' || next_session_number::text,
    'active',
    auth.uid(),
    next_session_number
  )
  returning * into current_session;

  insert into public.session_attendees (
    session_id,
    user_id,
    role,
    display_name,
    selected_character_id,
    added_by_user_id
  )
  select
    current_session.id,
    cm.user_id,
    cm.role,
    cm.display_name,
    cm.selected_character_id,
    auth.uid()
  from public.campaign_members cm
  where cm.campaign_id = p_campaign_id
    and cm.user_id = auth.uid()
  on conflict (session_id, user_id) do nothing;

  return current_session;
end;
$$;

create or replace function public.end_current_game_session(p_campaign_id uuid)
returns public.game_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  closed_session public.game_sessions%rowtype;
begin
  if not public.is_campaign_dm(p_campaign_id) then
    raise exception 'Only a campaign DM can end a session.';
  end if;

  update public.game_sessions
  set status = 'closed',
      ended_at = now()
  where campaign_id = p_campaign_id
    and status = 'active'
  returning * into closed_session;

  if closed_session.id is null then
    raise exception 'No active session to end.';
  end if;

  return closed_session;
end;
$$;

grant execute on function public.start_current_game_session(uuid) to authenticated;
grant execute on function public.end_current_game_session(uuid) to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'session_attendees'
  ) then
    alter publication supabase_realtime add table public.session_attendees;
  end if;
end $$;

notify pgrst, 'reload schema';
