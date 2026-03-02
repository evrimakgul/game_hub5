create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  profile_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.characters (
  character_id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (profile_id) on delete cascade,
  display_name text not null,
  is_player_character boolean not null default true,
  age integer,
  biography_primary text,
  biography_secondary text,
  xp_used integer not null default 0 check (xp_used >= 0),
  money integer not null default 0 check (money >= 0),
  inspiration integer not null default 0 check (inspiration >= 0),
  positive_karma integer not null default 0 check (positive_karma >= 0),
  negative_karma integer not null default 0 check (negative_karma >= 0),
  current_hp integer not null default 0,
  current_mana integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.character_core_stats (
  character_id uuid not null references public.characters (character_id) on delete cascade,
  stat_id text not null check (
    stat_id = any (array['STR', 'DEX', 'STAM', 'CHA', 'APP', 'MAN', 'INT', 'WITS', 'PER']::text[])
  ),
  level integer not null check (level >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (character_id, stat_id)
);

create table if not exists public.character_skill_levels (
  character_id uuid not null references public.characters (character_id) on delete cascade,
  skill_id text not null check (
    skill_id = any (
      array[
        'melee',
        'ranged',
        'athletics',
        'stealth',
        'alertness',
        'intimidation',
        'social',
        'medicine',
        'technology',
        'academics',
        'mechanics',
        'occultism',
        'archery_or_guns',
        'energy_weapons'
      ]::text[]
    )
  ),
  level integer not null check (level >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (character_id, skill_id)
);

create table if not exists public.character_known_powers (
  character_id uuid not null references public.characters (character_id) on delete cascade,
  power_id text not null check (
    power_id = any (
      array[
        'awareness',
        'body_reinforcement',
        'crowd_control',
        'elementalist',
        'healing',
        'light_support',
        'necromancy',
        'shadow_control'
      ]::text[]
    )
  ),
  level integer not null check (level >= 0),
  learned_from text not null check (learned_from = any (array['xp', 'item', 'npc', 'other']::text[])),
  unlocked_at_xp integer check (unlocked_at_xp is null or unlocked_at_xp >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (character_id, power_id)
);

create table if not exists public.character_traits (
  character_trait_id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters (character_id) on delete cascade,
  selection_type text not null check (selection_type = any (array['trait', 'merit', 'flaw']::text[])),
  selection_id text not null,
  label text not null,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (character_id, selection_type, selection_id)
);

create table if not exists public.item_templates (
  item_template_id text primary key,
  name text not null,
  quality text not null check (
    quality = any (
      array[
        'common',
        'uncommon',
        'masterwork',
        'rare',
        'epic',
        'legendary',
        'mythical',
        'celestial',
        'demonic',
        'artifact'
      ]::text[]
    )
  ),
  body_part text not null check (
    body_part = any (array['hands', 'head', 'neck', 'fingers', 'upper_body', 'orbital', 'none']::text[])
  ),
  item_type text not null check (
    item_type = any (
      array[
        'none',
        'one_handed_weapon',
        'two_handed_weapon',
        'shield',
        'brawl_item',
        'amulet',
        'ring',
        'occult',
        'armor',
        'bow',
        'crossbow'
      ]::text[]
    )
  ),
  spec text not null check (spec = any (array['none', 'single_use', 'permanent']::text[])),
  slot_compatibility text[] not null default '{}'::text[],
  labels text[] not null default '{}'::text[],
  bid_cost integer check (bid_cost is null or bid_cost >= 0),
  buyout_cost integer check (buyout_cost is null or buyout_cost >= 0),
  modifiers jsonb not null default '[]'::jsonb,
  effects jsonb not null default '[]'::jsonb,
  remarks text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.inventory_items (
  item_instance_id uuid primary key default gen_random_uuid(),
  template_id text not null references public.item_templates (item_template_id) on delete restrict,
  owner_character_id uuid not null references public.characters (character_id) on delete cascade,
  quantity integer not null default 1 check (quantity >= 0),
  charges integer check (charges is null or charges >= 0),
  durability integer check (durability is null or durability >= 0),
  custom_name text,
  equipped_slot text check (
    equipped_slot is null
    or equipped_slot = any (
      array['head', 'neck', 'body', 'right_hand', 'left_hand', 'ring_right', 'ring_left']::text[]
    )
  ),
  acquired_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists inventory_items_owner_equipped_slot_unique
  on public.inventory_items (owner_character_id, equipped_slot)
  where equipped_slot is not null;

create table if not exists public.character_status_effects (
  character_status_effect_id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters (character_id) on delete cascade,
  status_effect_id text not null,
  label text not null,
  source_type text not null check (
    source_type = any (array['item', 'power', 'combat', 'environment', 'trait', 'other']::text[])
  ),
  source_id text,
  stacks integer not null default 1 check (stacks >= 0),
  applied_at timestamptz,
  expires_at timestamptz,
  remaining_rounds integer check (remaining_rounds is null or remaining_rounds >= 0),
  effects jsonb not null default '[]'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.combat_encounters (
  encounter_id uuid primary key default gen_random_uuid(),
  label text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.combat_participants (
  participant_id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references public.combat_encounters (encounter_id) on delete cascade,
  character_id uuid references public.characters (character_id) on delete set null,
  display_name text not null,
  kind text not null check (kind = any (array['character', 'npc', 'summon']::text[])),
  state text not null check (state = any (array['active', 'defeated', 'removed']::text[])),
  initiative integer not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.combat_tracker (
  encounter_id uuid primary key references public.combat_encounters (encounter_id) on delete cascade,
  round_number integer not null default 1 check (round_number >= 1),
  initiative_order uuid[] not null default '{}'::uuid[],
  active_participant_id uuid references public.combat_participants (participant_id) on delete set null,
  active_index integer check (active_index is null or active_index >= 0),
  available_standard integer not null default 1 check (available_standard >= 0),
  available_bonus integer not null default 1 check (available_bonus >= 0),
  available_move integer not null default 1 check (available_move >= 0),
  available_reaction integer not null default 1 check (available_reaction >= 0),
  available_free integer check (available_free is null or available_free >= 0),
  spent_standard integer not null default 0 check (spent_standard >= 0),
  spent_bonus integer not null default 0 check (spent_bonus >= 0),
  spent_move integer not null default 0 check (spent_move >= 0),
  spent_reaction integer not null default 0 check (spent_reaction >= 0),
  spent_free integer not null default 0 check (spent_free >= 0),
  turn_started_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.combat_logs (
  combat_log_entry_id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references public.combat_encounters (encounter_id) on delete cascade,
  participant_id uuid references public.combat_participants (participant_id) on delete set null,
  message text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists characters_profile_id_idx
  on public.characters (profile_id);

create index if not exists inventory_items_owner_character_id_idx
  on public.inventory_items (owner_character_id);

create index if not exists character_status_effects_character_id_idx
  on public.character_status_effects (character_id);

create index if not exists combat_participants_encounter_id_idx
  on public.combat_participants (encounter_id);

create index if not exists combat_logs_encounter_id_idx
  on public.combat_logs (encounter_id);

drop trigger if exists profiles_set_updated_at on public.profiles;

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists characters_set_updated_at on public.characters;

create trigger characters_set_updated_at
before update on public.characters
for each row
execute function public.set_updated_at();

drop trigger if exists character_core_stats_set_updated_at on public.character_core_stats;

create trigger character_core_stats_set_updated_at
before update on public.character_core_stats
for each row
execute function public.set_updated_at();

drop trigger if exists character_skill_levels_set_updated_at on public.character_skill_levels;

create trigger character_skill_levels_set_updated_at
before update on public.character_skill_levels
for each row
execute function public.set_updated_at();

drop trigger if exists character_known_powers_set_updated_at on public.character_known_powers;

create trigger character_known_powers_set_updated_at
before update on public.character_known_powers
for each row
execute function public.set_updated_at();

drop trigger if exists character_traits_set_updated_at on public.character_traits;

create trigger character_traits_set_updated_at
before update on public.character_traits
for each row
execute function public.set_updated_at();

drop trigger if exists item_templates_set_updated_at on public.item_templates;

create trigger item_templates_set_updated_at
before update on public.item_templates
for each row
execute function public.set_updated_at();

drop trigger if exists inventory_items_set_updated_at on public.inventory_items;

create trigger inventory_items_set_updated_at
before update on public.inventory_items
for each row
execute function public.set_updated_at();

drop trigger if exists character_status_effects_set_updated_at on public.character_status_effects;

create trigger character_status_effects_set_updated_at
before update on public.character_status_effects
for each row
execute function public.set_updated_at();

drop trigger if exists combat_encounters_set_updated_at on public.combat_encounters;

create trigger combat_encounters_set_updated_at
before update on public.combat_encounters
for each row
execute function public.set_updated_at();

drop trigger if exists combat_participants_set_updated_at on public.combat_participants;

create trigger combat_participants_set_updated_at
before update on public.combat_participants
for each row
execute function public.set_updated_at();

drop trigger if exists combat_tracker_set_updated_at on public.combat_tracker;

create trigger combat_tracker_set_updated_at
before update on public.combat_tracker
for each row
execute function public.set_updated_at();
