create extension if not exists pgcrypto;

do $$
begin
  if to_regclass('public.profiles') is null then
    create table public.profiles (
      id uuid primary key references auth.users(id) on delete cascade,
      display_name text not null default '',
      created_at timestamptz not null default now()
    );
  else
    alter table public.profiles add column if not exists id uuid;
    alter table public.profiles add column if not exists display_name text not null default '';
    alter table public.profiles add column if not exists created_at timestamptz not null default now();

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'profiles'
        and column_name = 'user_id'
    ) then
      update public.profiles
      set id = user_id
      where id is null;
    end if;
  end if;
end $$;

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.campaign_members (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('dm', 'player')),
  display_name text not null default '',
  selected_character_id text,
  joined_at timestamptz not null default now(),
  primary key (campaign_id, user_id)
);

create table if not exists public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  label text not null,
  status text not null default 'active' check (status in ('active', 'closed')),
  created_by uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  session_notes text not null default ''
);

create table if not exists public.session_characters (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  character_id text not null,
  owner_user_id uuid references auth.users(id) on delete set null,
  owner_role text not null check (owner_role in ('dm', 'player')),
  display_name text not null,
  sheet_payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (session_id, character_id)
);

create table if not exists public.session_events (
  id text primary key,
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  kind text not null check (kind in ('message', 'roll', 'share', 'reward', 'note', 'pin')),
  visibility text not null check (visibility in ('public', 'limited', 'dm_only', 'dm_and_actor')),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_character_id text,
  actor_display_name text not null default '',
  target_user_ids uuid[] not null default '{}',
  target_character_ids text[] not null default '{}',
  summary text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.session_pins (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  kind text not null check (kind in ('npc', 'card', 'location', 'note')),
  label text not null,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.knowledge_entities (
  id text primary key,
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  type text not null,
  subject_key text,
  display_name text not null,
  created_at timestamptz not null default now(),
  unique (session_id, type, subject_key)
);

create table if not exists public.knowledge_revisions (
  id text primary key,
  entity_id text not null references public.knowledge_entities(id) on delete cascade,
  revision_number integer not null,
  title text not null,
  summary text not null default '',
  content jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}',
  source_type text not null,
  parent_revision_id text references public.knowledge_revisions(id) on delete set null,
  lineage_mode text not null,
  is_canonical boolean not null default false,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (entity_id, revision_number)
);

create table if not exists public.knowledge_ownerships (
  id text primary key,
  revision_id text not null references public.knowledge_revisions(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  owner_character_id text not null,
  acquired_from_user_id uuid references auth.users(id) on delete set null,
  local_label text not null default '',
  is_pinned boolean not null default false,
  is_archived boolean not null default false,
  acquired_at timestamptz not null default now(),
  unique (revision_id, owner_character_id)
);

create index if not exists campaign_members_user_idx on public.campaign_members (user_id, campaign_id);
create index if not exists game_sessions_campaign_status_idx on public.game_sessions (campaign_id, status);
create index if not exists session_characters_session_idx on public.session_characters (session_id, owner_user_id);
create index if not exists session_events_session_created_idx on public.session_events (session_id, created_at);
create index if not exists knowledge_entities_session_idx on public.knowledge_entities (session_id, type, subject_key);
create index if not exists knowledge_ownerships_owner_idx on public.knowledge_ownerships (owner_user_id, owner_character_id);

create or replace function public.is_campaign_member(target_campaign_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.campaign_members cm
    where cm.campaign_id = target_campaign_id
      and cm.user_id = auth.uid()
  );
$$;

create or replace function public.is_campaign_owner(target_campaign_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.campaigns c
    where c.id = target_campaign_id
      and c.owner_user_id = auth.uid()
  );
$$;

create or replace function public.is_campaign_dm(target_campaign_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.campaign_members cm
    where cm.campaign_id = target_campaign_id
      and cm.user_id = auth.uid()
      and cm.role = 'dm'
  );
$$;

create or replace function public.session_campaign_id(target_session_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select gs.campaign_id
  from public.game_sessions gs
  where gs.id = target_session_id
$$;

create or replace function public.is_session_member(target_session_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_campaign_member(public.session_campaign_id(target_session_id));
$$;

create or replace function public.is_session_dm(target_session_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_campaign_dm(public.session_campaign_id(target_session_id));
$$;

alter table public.profiles enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_members enable row level security;
alter table public.game_sessions enable row level security;
alter table public.session_characters enable row level security;
alter table public.session_events enable row level security;
alter table public.session_pins enable row level security;
alter table public.knowledge_entities enable row level security;
alter table public.knowledge_revisions enable row level security;
alter table public.knowledge_ownerships enable row level security;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select *
    from (values
      ('profiles', 'profiles_self_select'),
      ('profiles', 'profiles_self_insert'),
      ('profiles', 'profiles_self_update'),
      ('campaigns', 'campaigns_member_select'),
      ('campaigns', 'campaigns_owner_insert'),
      ('campaigns', 'campaigns_dm_update'),
      ('campaign_members', 'campaign_members_member_select'),
      ('campaign_members', 'campaign_members_dm_write'),
      ('campaign_members', 'campaign_members_owner_insert'),
      ('game_sessions', 'game_sessions_member_select'),
      ('game_sessions', 'game_sessions_dm_write'),
      ('session_characters', 'session_characters_member_select'),
      ('session_characters', 'session_characters_dm_write'),
      ('session_characters', 'session_characters_owner_update'),
      ('session_events', 'session_events_member_select'),
      ('session_events', 'session_events_member_insert'),
      ('session_events', 'session_events_dm_update'),
      ('session_pins', 'session_pins_member_select'),
      ('session_pins', 'session_pins_dm_write'),
      ('knowledge_entities', 'knowledge_entities_member_select'),
      ('knowledge_entities', 'knowledge_entities_member_insert'),
      ('knowledge_revisions', 'knowledge_revisions_member_select'),
      ('knowledge_revisions', 'knowledge_revisions_member_insert'),
      ('knowledge_ownerships', 'knowledge_ownerships_select'),
      ('knowledge_ownerships', 'knowledge_ownerships_insert')
    ) as policies(table_name, policy_name)
  loop
    execute format('drop policy if exists %I on public.%I', policy_record.policy_name, policy_record.table_name);
  end loop;
end $$;

create policy profiles_self_select on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_self_insert on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_self_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy campaigns_member_select on public.campaigns for select to authenticated using (
  owner_user_id = auth.uid() or public.is_campaign_member(id)
);
create policy campaigns_owner_insert on public.campaigns for insert to authenticated with check (owner_user_id = auth.uid());
create policy campaigns_dm_update on public.campaigns for update to authenticated using (public.is_campaign_dm(id)) with check (public.is_campaign_dm(id));

create policy campaign_members_member_select on public.campaign_members for select to authenticated using (public.is_campaign_member(campaign_id));
create policy campaign_members_dm_write on public.campaign_members for all to authenticated using (public.is_campaign_dm(campaign_id)) with check (public.is_campaign_dm(campaign_id));
create policy campaign_members_owner_insert on public.campaign_members for insert to authenticated with check (
  user_id = auth.uid()
  and role = 'dm'
  and public.is_campaign_owner(campaign_id)
);

create policy game_sessions_member_select on public.game_sessions for select to authenticated using (public.is_campaign_member(campaign_id));
create policy game_sessions_dm_write on public.game_sessions for all to authenticated using (public.is_campaign_dm(campaign_id)) with check (public.is_campaign_dm(campaign_id));

create policy session_characters_member_select on public.session_characters for select to authenticated using (public.is_session_member(session_id));
create policy session_characters_dm_write on public.session_characters for all to authenticated using (public.is_session_dm(session_id)) with check (public.is_session_dm(session_id));
create policy session_characters_owner_update on public.session_characters for update to authenticated using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());

create policy session_events_member_select on public.session_events for select to authenticated using (
  public.is_session_dm(session_id)
  or visibility = 'public'
  or (visibility = 'limited' and auth.uid() = any(target_user_ids))
  or (
    visibility = 'limited'
    and exists (
      select 1
      from public.session_characters sc
      where sc.session_id = session_events.session_id
        and sc.owner_user_id = auth.uid()
        and sc.character_id = any(session_events.target_character_ids)
    )
  )
  or (visibility = 'dm_and_actor' and actor_user_id = auth.uid())
);
create policy session_events_member_insert on public.session_events for insert to authenticated with check (
  public.is_session_member(session_id)
  and actor_user_id = auth.uid()
);
create policy session_events_dm_update on public.session_events for update to authenticated using (public.is_session_dm(session_id)) with check (public.is_session_dm(session_id));

create policy session_pins_member_select on public.session_pins for select to authenticated using (public.is_session_member(session_id));
create policy session_pins_dm_write on public.session_pins for all to authenticated using (public.is_session_dm(session_id)) with check (public.is_session_dm(session_id));

create policy knowledge_entities_member_select on public.knowledge_entities for select to authenticated using (public.is_session_member(session_id));
create policy knowledge_entities_member_insert on public.knowledge_entities for insert to authenticated with check (public.is_session_member(session_id));

create policy knowledge_revisions_member_select on public.knowledge_revisions for select to authenticated using (
  exists (
    select 1
    from public.knowledge_entities ke
    where ke.id = entity_id and public.is_session_member(ke.session_id)
  )
);
create policy knowledge_revisions_member_insert on public.knowledge_revisions for insert to authenticated with check (
  exists (
    select 1
    from public.knowledge_entities ke
    where ke.id = entity_id and public.is_session_member(ke.session_id)
  )
);

create policy knowledge_ownerships_select on public.knowledge_ownerships for select to authenticated using (
  owner_user_id = auth.uid()
  or exists (
    select 1
    from public.knowledge_revisions kr
    join public.knowledge_entities ke on ke.id = kr.entity_id
    where kr.id = revision_id and public.is_session_dm(ke.session_id)
  )
);
create policy knowledge_ownerships_insert on public.knowledge_ownerships for insert to authenticated with check (
  owner_user_id = auth.uid()
  or exists (
    select 1
    from public.knowledge_revisions kr
    join public.knowledge_entities ke on ke.id = kr.entity_id
    where kr.id = revision_id and public.is_session_member(ke.session_id)
  )
);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'session_events'
    ) then
      alter publication supabase_realtime add table public.session_events;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'session_characters'
    ) then
      alter publication supabase_realtime add table public.session_characters;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'campaign_members'
    ) then
      alter publication supabase_realtime add table public.campaign_members;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'knowledge_ownerships'
    ) then
      alter publication supabase_realtime add table public.knowledge_ownerships;
    end if;
  end if;
end $$;

notify pgrst, 'reload schema';
