create table if not exists public.player_characters (
  id uuid primary key default gen_random_uuid(),
  character_id text not null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default '',
  sheet_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, character_id)
);

create index if not exists player_characters_owner_idx
  on public.player_characters (owner_user_id, updated_at desc);

alter table public.player_characters enable row level security;

drop policy if exists player_characters_owner_select on public.player_characters;
drop policy if exists player_characters_owner_insert on public.player_characters;
drop policy if exists player_characters_owner_update on public.player_characters;
drop policy if exists player_characters_owner_delete on public.player_characters;

create policy player_characters_owner_select
  on public.player_characters for select to authenticated
  using (owner_user_id = auth.uid());

create policy player_characters_owner_insert
  on public.player_characters for insert to authenticated
  with check (owner_user_id = auth.uid());

create policy player_characters_owner_update
  on public.player_characters for update to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy player_characters_owner_delete
  on public.player_characters for delete to authenticated
  using (owner_user_id = auth.uid());

grant select, insert, update, delete on public.player_characters to authenticated;

insert into public.player_characters (
  character_id,
  owner_user_id,
  display_name,
  sheet_payload,
  created_at,
  updated_at
)
select distinct on (owner_user_id, character_id)
  character_id,
  owner_user_id,
  display_name,
  sheet_payload,
  updated_at,
  updated_at
from public.campaign_characters
order by owner_user_id, character_id, updated_at desc
on conflict (owner_user_id, character_id) do update
set
  display_name = excluded.display_name,
  sheet_payload = excluded.sheet_payload,
  updated_at = excluded.updated_at
where public.player_characters.updated_at < excluded.updated_at;
