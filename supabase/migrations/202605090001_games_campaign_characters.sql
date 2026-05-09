create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.game_members (
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('dm', 'player')),
  display_name text not null default '',
  joined_at timestamptz not null default now(),
  primary key (game_id, user_id)
);

alter table public.campaigns add column if not exists game_id uuid references public.games(id) on delete cascade;

create table if not exists public.campaign_characters (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  character_id text not null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  sheet_payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (campaign_id, character_id)
);

create index if not exists game_members_user_idx on public.game_members (user_id, game_id);
create index if not exists campaigns_game_idx on public.campaigns (game_id);
create index if not exists campaign_characters_campaign_owner_idx on public.campaign_characters (campaign_id, owner_user_id);

do $$
declare
  campaign_record record;
  default_game_id uuid;
begin
  for campaign_record in
    select *
    from public.campaigns
    where game_id is null
    order by created_at asc
  loop
    insert into public.games (name, owner_user_id, created_at)
    values (campaign_record.name || ' Game', campaign_record.owner_user_id, campaign_record.created_at)
    returning id into default_game_id;

    update public.campaigns
    set game_id = default_game_id
    where id = campaign_record.id;

    insert into public.game_members (game_id, user_id, role, display_name, joined_at)
    select default_game_id, cm.user_id, cm.role, cm.display_name, cm.joined_at
    from public.campaign_members cm
    where cm.campaign_id = campaign_record.id
    on conflict (game_id, user_id) do nothing;
  end loop;
end $$;

alter table public.games enable row level security;
alter table public.game_members enable row level security;
alter table public.campaign_characters enable row level security;

create or replace function public.is_game_member(target_game_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.game_members gm
    where gm.game_id = target_game_id
      and gm.user_id = auth.uid()
  );
$$;

create or replace function public.is_game_dm(target_game_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.game_members gm
    where gm.game_id = target_game_id
      and gm.user_id = auth.uid()
      and gm.role = 'dm'
  );
$$;

drop policy if exists games_member_select on public.games;
drop policy if exists games_owner_insert on public.games;
drop policy if exists games_dm_update on public.games;
drop policy if exists game_members_member_select on public.game_members;
drop policy if exists game_members_dm_write on public.game_members;
drop policy if exists campaign_characters_member_select on public.campaign_characters;
drop policy if exists campaign_characters_owner_write on public.campaign_characters;
drop policy if exists campaign_characters_dm_write on public.campaign_characters;

create policy games_member_select on public.games for select to authenticated using (
  owner_user_id = auth.uid() or public.is_game_member(id)
);
create policy games_owner_insert on public.games for insert to authenticated with check (owner_user_id = auth.uid());
create policy games_dm_update on public.games for update to authenticated using (public.is_game_dm(id)) with check (public.is_game_dm(id));

create policy game_members_member_select on public.game_members for select to authenticated using (public.is_game_member(game_id));
create policy game_members_dm_write on public.game_members for all to authenticated using (public.is_game_dm(game_id)) with check (public.is_game_dm(game_id));

create policy campaign_characters_member_select on public.campaign_characters for select to authenticated using (public.is_campaign_member(campaign_id));
create policy campaign_characters_owner_write on public.campaign_characters for all to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid() and public.is_campaign_member(campaign_id));
create policy campaign_characters_dm_write on public.campaign_characters for all to authenticated
  using (public.is_campaign_dm(campaign_id))
  with check (public.is_campaign_dm(campaign_id));

create or replace function public.create_game_with_campaign(
  p_game_name text,
  p_campaign_name text,
  p_owner_display_name text default 'Dungeon Master'
)
returns table (
  game_id uuid,
  game_name text,
  game_owner_user_id uuid,
  game_created_at timestamptz,
  campaign_id uuid,
  campaign_name text,
  campaign_owner_user_id uuid,
  campaign_created_at timestamptz,
  member_user_id uuid,
  member_role text,
  member_display_name text,
  member_selected_character_id text,
  member_joined_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  new_game public.games%rowtype;
  new_campaign public.campaigns%rowtype;
  new_member public.campaign_members%rowtype;
  resolved_display_name text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required to create a game.';
  end if;

  resolved_display_name := coalesce(nullif(trim(p_owner_display_name), ''), 'Dungeon Master');

  insert into public.games (name, owner_user_id)
  values (coalesce(nullif(trim(p_game_name), ''), 'Convergence Game'), auth.uid())
  returning * into new_game;

  insert into public.game_members (game_id, user_id, role, display_name)
  values (new_game.id, auth.uid(), 'dm', resolved_display_name);

  insert into public.campaigns (name, owner_user_id, game_id)
  values (coalesce(nullif(trim(p_campaign_name), ''), 'Campaign 1'), auth.uid(), new_game.id)
  returning * into new_campaign;

  insert into public.campaign_members (
    campaign_id,
    user_id,
    role,
    display_name,
    selected_character_id
  )
  values (
    new_campaign.id,
    auth.uid(),
    'dm',
    resolved_display_name,
    null
  )
  returning * into new_member;

  return query
  select
    new_game.id,
    new_game.name,
    new_game.owner_user_id,
    new_game.created_at,
    new_campaign.id,
    new_campaign.name,
    new_campaign.owner_user_id,
    new_campaign.created_at,
    new_member.user_id,
    new_member.role,
    new_member.display_name,
    new_member.selected_character_id,
    new_member.joined_at;
end;
$$;

create or replace function public.list_joinable_campaigns()
returns table (
  campaign_id uuid,
  campaign_name text,
  campaign_owner_user_id uuid,
  campaign_created_at timestamptz,
  game_id uuid,
  game_name text,
  is_member boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    c.id,
    c.name,
    c.owner_user_id,
    c.created_at,
    g.id,
    g.name,
    public.is_campaign_member(c.id)
  from public.campaigns c
  left join public.games g on g.id = c.game_id
  order by g.created_at desc nulls last, c.created_at desc;
$$;

create or replace function public.join_campaign(
  p_campaign_id uuid,
  p_display_name text default ''
)
returns public.campaign_members
language plpgsql
security definer
set search_path = public
as $$
declare
  campaign_record public.campaigns%rowtype;
  joined_member public.campaign_members%rowtype;
  resolved_display_name text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required to join a campaign.';
  end if;

  select * into campaign_record
  from public.campaigns
  where id = p_campaign_id;

  if campaign_record.id is null then
    raise exception 'Campaign not found.';
  end if;

  resolved_display_name := coalesce(nullif(trim(p_display_name), ''), 'Player');

  if campaign_record.game_id is not null then
    insert into public.game_members (game_id, user_id, role, display_name)
    values (campaign_record.game_id, auth.uid(), 'player', resolved_display_name)
    on conflict (game_id, user_id) do update
    set role = excluded.role,
        display_name = excluded.display_name;
  end if;

  insert into public.campaign_members (
    campaign_id,
    user_id,
    role,
    display_name,
    selected_character_id
  )
  values (p_campaign_id, auth.uid(), 'player', resolved_display_name, null)
  on conflict (campaign_id, user_id) do update
  set role = excluded.role,
      display_name = excluded.display_name
  returning * into joined_member;

  return joined_member;
end;
$$;

grant execute on function public.create_game_with_campaign(text, text, text) to authenticated;
grant execute on function public.list_joinable_campaigns() to authenticated;
grant execute on function public.join_campaign(uuid, text) to authenticated;

notify pgrst, 'reload schema';
