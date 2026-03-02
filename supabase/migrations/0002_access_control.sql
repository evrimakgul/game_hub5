alter table public.profiles
  add column if not exists app_role text not null default 'player'
  check (app_role = any (array['player', 'dm']::text[]));

create or replace function public.is_dm()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where profile_id = auth.uid()
      and app_role = 'dm'
  );
$$;

create or replace function public.owns_character(target_character_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.characters
    where character_id = target_character_id
      and profile_id = auth.uid()
  );
$$;

create or replace function public.can_access_encounter(target_encounter_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.combat_participants cp
    join public.characters c on c.character_id = cp.character_id
    where cp.encounter_id = target_encounter_id
      and c.profile_id = auth.uid()
  );
$$;

create or replace function public.is_active_participant_owner(target_encounter_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.combat_tracker ct
    join public.combat_participants cp on cp.participant_id = ct.active_participant_id
    join public.characters c on c.character_id = cp.character_id
    where ct.encounter_id = target_encounter_id
      and c.profile_id = auth.uid()
  );
$$;

create or replace function public.enforce_character_owner_update_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_dm() then
    return new;
  end if;

  if auth.uid() is distinct from old.profile_id then
    raise exception 'Only the owning player can update this character.';
  end if;

  if row(
    new.profile_id,
    new.display_name,
    new.is_player_character,
    new.age,
    new.biography_primary,
    new.biography_secondary,
    new.xp_used,
    new.money,
    new.inspiration,
    new.positive_karma,
    new.negative_karma
  ) is distinct from row(
    old.profile_id,
    old.display_name,
    old.is_player_character,
    old.age,
    old.biography_primary,
    old.biography_secondary,
    old.xp_used,
    old.money,
    old.inspiration,
    old.positive_karma,
    old.negative_karma
  ) then
    raise exception 'Players may only update current HP and current Mana on their own character rows.';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_combat_tracker_owner_update_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_dm() then
    return new;
  end if;

  if not public.is_active_participant_owner(old.encounter_id) then
    raise exception 'Only the active participant owner can update combat action state.';
  end if;

  if row(
    new.encounter_id,
    new.round_number,
    new.initiative_order,
    new.active_participant_id,
    new.active_index,
    new.turn_started_at
  ) is distinct from row(
    old.encounter_id,
    old.round_number,
    old.initiative_order,
    old.active_participant_id,
    old.active_index,
    old.turn_started_at
  ) then
    raise exception 'Players may only update action availability and spent action counts.';
  end if;

  return new;
end;
$$;

drop trigger if exists characters_owner_scope_guard on public.characters;

create trigger characters_owner_scope_guard
before update on public.characters
for each row
execute function public.enforce_character_owner_update_scope();

drop trigger if exists combat_tracker_owner_scope_guard on public.combat_tracker;

create trigger combat_tracker_owner_scope_guard
before update on public.combat_tracker
for each row
execute function public.enforce_combat_tracker_owner_update_scope();

alter table public.profiles enable row level security;
alter table public.characters enable row level security;
alter table public.character_core_stats enable row level security;
alter table public.character_skill_levels enable row level security;
alter table public.character_known_powers enable row level security;
alter table public.character_traits enable row level security;
alter table public.item_templates enable row level security;
alter table public.inventory_items enable row level security;
alter table public.character_status_effects enable row level security;
alter table public.combat_encounters enable row level security;
alter table public.combat_participants enable row level security;
alter table public.combat_tracker enable row level security;
alter table public.combat_logs enable row level security;

drop policy if exists profiles_select_own_or_dm on public.profiles;
create policy profiles_select_own_or_dm
on public.profiles
for select
using (auth.uid() = profile_id or public.is_dm());

drop policy if exists profiles_insert_self_or_dm on public.profiles;
create policy profiles_insert_self_or_dm
on public.profiles
for insert
with check (auth.uid() = profile_id or public.is_dm());

drop policy if exists profiles_update_own_or_dm on public.profiles;
create policy profiles_update_own_or_dm
on public.profiles
for update
using (auth.uid() = profile_id or public.is_dm())
with check (auth.uid() = profile_id or public.is_dm());

drop policy if exists characters_select_owner_or_dm on public.characters;
create policy characters_select_owner_or_dm
on public.characters
for select
using (public.owns_character(character_id) or public.is_dm());

drop policy if exists characters_insert_owner_or_dm on public.characters;
create policy characters_insert_owner_or_dm
on public.characters
for insert
with check (profile_id = auth.uid() or public.is_dm());

drop policy if exists characters_update_owner_or_dm on public.characters;
create policy characters_update_owner_or_dm
on public.characters
for update
using (public.owns_character(character_id) or public.is_dm())
with check (public.owns_character(character_id) or public.is_dm());

drop policy if exists characters_delete_dm_only on public.characters;
create policy characters_delete_dm_only
on public.characters
for delete
using (public.is_dm());

drop policy if exists character_core_stats_select_owner_or_dm on public.character_core_stats;
create policy character_core_stats_select_owner_or_dm
on public.character_core_stats
for select
using (public.owns_character(character_id) or public.is_dm());

drop policy if exists character_core_stats_write_dm_only on public.character_core_stats;
create policy character_core_stats_write_dm_only
on public.character_core_stats
for all
using (public.is_dm())
with check (public.is_dm());

drop policy if exists character_skill_levels_select_owner_or_dm on public.character_skill_levels;
create policy character_skill_levels_select_owner_or_dm
on public.character_skill_levels
for select
using (public.owns_character(character_id) or public.is_dm());

drop policy if exists character_skill_levels_write_dm_only on public.character_skill_levels;
create policy character_skill_levels_write_dm_only
on public.character_skill_levels
for all
using (public.is_dm())
with check (public.is_dm());

drop policy if exists character_known_powers_select_owner_or_dm on public.character_known_powers;
create policy character_known_powers_select_owner_or_dm
on public.character_known_powers
for select
using (public.owns_character(character_id) or public.is_dm());

drop policy if exists character_known_powers_write_dm_only on public.character_known_powers;
create policy character_known_powers_write_dm_only
on public.character_known_powers
for all
using (public.is_dm())
with check (public.is_dm());

drop policy if exists character_traits_select_owner_or_dm on public.character_traits;
create policy character_traits_select_owner_or_dm
on public.character_traits
for select
using (public.owns_character(character_id) or public.is_dm());

drop policy if exists character_traits_write_dm_only on public.character_traits;
create policy character_traits_write_dm_only
on public.character_traits
for all
using (public.is_dm())
with check (public.is_dm());

drop policy if exists item_templates_select_authenticated on public.item_templates;
create policy item_templates_select_authenticated
on public.item_templates
for select
using (auth.role() = 'authenticated' or public.is_dm());

drop policy if exists item_templates_write_dm_only on public.item_templates;
create policy item_templates_write_dm_only
on public.item_templates
for all
using (public.is_dm())
with check (public.is_dm());

drop policy if exists inventory_items_select_owner_or_dm on public.inventory_items;
create policy inventory_items_select_owner_or_dm
on public.inventory_items
for select
using (public.owns_character(owner_character_id) or public.is_dm());

drop policy if exists inventory_items_write_dm_only on public.inventory_items;
create policy inventory_items_write_dm_only
on public.inventory_items
for all
using (public.is_dm())
with check (public.is_dm());

drop policy if exists character_status_effects_select_owner_or_dm on public.character_status_effects;
create policy character_status_effects_select_owner_or_dm
on public.character_status_effects
for select
using (public.owns_character(character_id) or public.is_dm());

drop policy if exists character_status_effects_write_dm_only on public.character_status_effects;
create policy character_status_effects_write_dm_only
on public.character_status_effects
for all
using (public.is_dm())
with check (public.is_dm());

drop policy if exists combat_encounters_select_accessible_or_dm on public.combat_encounters;
create policy combat_encounters_select_accessible_or_dm
on public.combat_encounters
for select
using (public.can_access_encounter(encounter_id) or public.is_dm());

drop policy if exists combat_encounters_write_dm_only on public.combat_encounters;
create policy combat_encounters_write_dm_only
on public.combat_encounters
for all
using (public.is_dm())
with check (public.is_dm());

drop policy if exists combat_participants_select_accessible_or_dm on public.combat_participants;
create policy combat_participants_select_accessible_or_dm
on public.combat_participants
for select
using (public.can_access_encounter(encounter_id) or public.is_dm());

drop policy if exists combat_participants_write_dm_only on public.combat_participants;
create policy combat_participants_write_dm_only
on public.combat_participants
for all
using (public.is_dm())
with check (public.is_dm());

drop policy if exists combat_tracker_select_accessible_or_dm on public.combat_tracker;
create policy combat_tracker_select_accessible_or_dm
on public.combat_tracker
for select
using (public.can_access_encounter(encounter_id) or public.is_dm());

drop policy if exists combat_tracker_insert_dm_only on public.combat_tracker;
create policy combat_tracker_insert_dm_only
on public.combat_tracker
for insert
with check (public.is_dm());

drop policy if exists combat_tracker_update_active_owner_or_dm on public.combat_tracker;
create policy combat_tracker_update_active_owner_or_dm
on public.combat_tracker
for update
using (public.is_active_participant_owner(encounter_id) or public.is_dm())
with check (public.is_active_participant_owner(encounter_id) or public.is_dm());

drop policy if exists combat_tracker_delete_dm_only on public.combat_tracker;
create policy combat_tracker_delete_dm_only
on public.combat_tracker
for delete
using (public.is_dm());

drop policy if exists combat_logs_select_accessible_or_dm on public.combat_logs;
create policy combat_logs_select_accessible_or_dm
on public.combat_logs
for select
using (public.can_access_encounter(encounter_id) or public.is_dm());

drop policy if exists combat_logs_write_dm_only on public.combat_logs;
create policy combat_logs_write_dm_only
on public.combat_logs
for all
using (public.is_dm())
with check (public.is_dm());
