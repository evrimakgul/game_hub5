alter table public.characters replica identity full;
alter table public.character_core_stats replica identity full;
alter table public.character_skill_levels replica identity full;
alter table public.character_known_powers replica identity full;
alter table public.character_traits replica identity full;
alter table public.inventory_items replica identity full;
alter table public.character_status_effects replica identity full;
alter table public.combat_encounters replica identity full;
alter table public.combat_participants replica identity full;
alter table public.combat_tracker replica identity full;
alter table public.combat_logs replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    create publication supabase_realtime;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'characters'
  ) then
    alter publication supabase_realtime add table public.characters;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'character_core_stats'
  ) then
    alter publication supabase_realtime add table public.character_core_stats;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'character_skill_levels'
  ) then
    alter publication supabase_realtime add table public.character_skill_levels;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'character_known_powers'
  ) then
    alter publication supabase_realtime add table public.character_known_powers;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'character_traits'
  ) then
    alter publication supabase_realtime add table public.character_traits;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'inventory_items'
  ) then
    alter publication supabase_realtime add table public.inventory_items;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'character_status_effects'
  ) then
    alter publication supabase_realtime add table public.character_status_effects;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'combat_encounters'
  ) then
    alter publication supabase_realtime add table public.combat_encounters;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'combat_participants'
  ) then
    alter publication supabase_realtime add table public.combat_participants;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'combat_tracker'
  ) then
    alter publication supabase_realtime add table public.combat_tracker;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'combat_logs'
  ) then
    alter publication supabase_realtime add table public.combat_logs;
  end if;
end;
$$;
