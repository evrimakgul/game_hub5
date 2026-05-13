create table if not exists public.session_combat_states (
  session_id uuid primary key references public.game_sessions(id) on delete cascade,
  encounter_id text not null,
  encounter_label text not null,
  encounter_payload jsonb not null default '{}'::jsonb,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.session_combat_views (
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  viewer_character_id text not null,
  encounter_id text not null,
  encounter_label text not null,
  view_payload jsonb not null default '{}'::jsonb,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (session_id, viewer_character_id)
);

create index if not exists session_combat_views_session_idx
  on public.session_combat_views (session_id, viewer_character_id);

alter table public.session_combat_states enable row level security;
alter table public.session_combat_views enable row level security;

grant select, insert, update, delete on public.session_combat_states to authenticated;
grant select, insert, update, delete on public.session_combat_views to authenticated;

drop policy if exists session_combat_states_dm_select on public.session_combat_states;
drop policy if exists session_combat_states_dm_write on public.session_combat_states;
drop policy if exists session_combat_views_select on public.session_combat_views;
drop policy if exists session_combat_views_dm_write on public.session_combat_views;

create policy session_combat_states_dm_select
  on public.session_combat_states
  for select
  to authenticated
  using (public.is_session_dm(session_id));

create policy session_combat_states_dm_write
  on public.session_combat_states
  for all
  to authenticated
  using (public.is_session_dm(session_id))
  with check (public.is_session_dm(session_id));

create policy session_combat_views_select
  on public.session_combat_views
  for select
  to authenticated
  using (
    public.is_session_dm(session_id)
    or exists (
      select 1
      from public.session_characters sc
      where sc.session_id = session_combat_views.session_id
        and sc.character_id = session_combat_views.viewer_character_id
        and sc.owner_user_id = auth.uid()
    )
  );

create policy session_combat_views_dm_write
  on public.session_combat_views
  for all
  to authenticated
  using (public.is_session_dm(session_id))
  with check (public.is_session_dm(session_id));

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'session_combat_states'
    ) then
      alter publication supabase_realtime add table public.session_combat_states;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'session_combat_views'
    ) then
      alter publication supabase_realtime add table public.session_combat_views;
    end if;
  end if;
end $$;

notify pgrst, 'reload schema';
