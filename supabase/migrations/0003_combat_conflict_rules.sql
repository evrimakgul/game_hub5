alter table public.combat_tracker
  add column if not exists revision bigint not null default 0;

create or replace function public.bump_combat_tracker_revision()
returns trigger
language plpgsql
as $$
begin
  new.revision = old.revision + 1;
  return new;
end;
$$;

drop trigger if exists combat_tracker_revision_bump on public.combat_tracker;

create trigger combat_tracker_revision_bump
before update on public.combat_tracker
for each row
execute function public.bump_combat_tracker_revision();

drop policy if exists combat_tracker_update_active_owner_or_dm on public.combat_tracker;

drop policy if exists combat_tracker_update_dm_only on public.combat_tracker;
create policy combat_tracker_update_dm_only
on public.combat_tracker
for update
using (public.is_dm())
with check (public.is_dm());

create or replace function public.consume_combat_action(
  target_encounter_id uuid,
  requested_action text,
  expected_revision bigint
)
returns table (
  encounter_id uuid,
  revision bigint,
  round_number integer,
  active_participant_id uuid,
  active_index integer,
  consumed_from text,
  movement_meters integer,
  prepared_reaction boolean,
  available_standard integer,
  available_bonus integer,
  available_move integer,
  available_reaction integer,
  available_free integer,
  spent_standard integer,
  spent_bonus integer,
  spent_move integer,
  spent_reaction integer,
  spent_free integer,
  turn_started_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  tracker_row public.combat_tracker%rowtype;
  next_available_standard integer;
  next_available_bonus integer;
  next_available_move integer;
  next_available_reaction integer;
  next_available_free integer;
  next_spent_standard integer;
  next_spent_bonus integer;
  next_spent_move integer;
  next_spent_reaction integer;
  next_spent_free integer;
  resolved_source text;
  resolved_movement integer := 0;
  resolved_prepared_reaction boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  select *
  into tracker_row
  from public.combat_tracker
  where encounter_id = target_encounter_id
  for update;

  if not found then
    raise exception 'Combat tracker not found for encounter %.', target_encounter_id;
  end if;

  if tracker_row.revision <> expected_revision then
    raise exception 'Combat tracker revision mismatch. Expected %, found %.', expected_revision, tracker_row.revision;
  end if;

  if not public.is_dm() and not public.is_active_participant_owner(target_encounter_id) then
    raise exception 'Only the active participant owner or a DM may consume combat actions.';
  end if;

  next_available_standard := tracker_row.available_standard;
  next_available_bonus := tracker_row.available_bonus;
  next_available_move := tracker_row.available_move;
  next_available_reaction := tracker_row.available_reaction;
  next_available_free := tracker_row.available_free;
  next_spent_standard := tracker_row.spent_standard;
  next_spent_bonus := tracker_row.spent_bonus;
  next_spent_move := tracker_row.spent_move;
  next_spent_reaction := tracker_row.spent_reaction;
  next_spent_free := tracker_row.spent_free;

  case requested_action
    when 'standard' then
      if next_available_standard <= 0 then
        raise exception 'No Standard Action available.';
      end if;
      next_available_standard := next_available_standard - 1;
      next_spent_standard := next_spent_standard + 1;
      resolved_source := 'standard';
    when 'bonus' then
      if next_available_bonus > 0 then
        next_available_bonus := next_available_bonus - 1;
        next_spent_bonus := next_spent_bonus + 1;
        resolved_source := 'bonus';
      elsif next_available_standard > 0 then
        next_available_standard := next_available_standard - 1;
        next_spent_standard := next_spent_standard + 1;
        resolved_source := 'standard';
      else
        raise exception 'No Bonus Action or substitutable Standard Action available.';
      end if;
    when 'move' then
      if next_available_move > 0 then
        next_available_move := next_available_move - 1;
        next_spent_move := next_spent_move + 1;
        resolved_source := 'move';
        resolved_movement := 5;
      elsif next_available_standard > 0 then
        next_available_standard := next_available_standard - 1;
        next_spent_standard := next_spent_standard + 1;
        resolved_source := 'standard';
        resolved_movement := 25;
      else
        raise exception 'No Move Action or substitutable Standard Action available.';
      end if;
    when 'reaction' then
      if next_available_reaction <= 0 then
        raise exception 'No Reaction available.';
      end if;
      next_available_reaction := next_available_reaction - 1;
      next_spent_reaction := next_spent_reaction + 1;
      resolved_source := 'reaction';
    when 'free' then
      next_spent_free := next_spent_free + 1;
      resolved_source := 'free';
    when 'prepare_reaction' then
      if next_available_standard <= 0 then
        raise exception 'No Standard Action available to prepare a reaction.';
      end if;
      next_available_standard := next_available_standard - 1;
      next_spent_standard := next_spent_standard + 1;
      resolved_source := 'standard';
      resolved_prepared_reaction := true;
    else
      raise exception 'Unsupported action request: %.', requested_action;
  end case;

  update public.combat_tracker
  set
    available_standard = next_available_standard,
    available_bonus = next_available_bonus,
    available_move = next_available_move,
    available_reaction = next_available_reaction,
    available_free = next_available_free,
    spent_standard = next_spent_standard,
    spent_bonus = next_spent_bonus,
    spent_move = next_spent_move,
    spent_reaction = next_spent_reaction,
    spent_free = next_spent_free
  where encounter_id = target_encounter_id;

  return query
  select
    ct.encounter_id,
    ct.revision,
    ct.round_number,
    ct.active_participant_id,
    ct.active_index,
    resolved_source,
    resolved_movement,
    resolved_prepared_reaction,
    ct.available_standard,
    ct.available_bonus,
    ct.available_move,
    ct.available_reaction,
    ct.available_free,
    ct.spent_standard,
    ct.spent_bonus,
    ct.spent_move,
    ct.spent_reaction,
    ct.spent_free,
    ct.turn_started_at,
    ct.updated_at
  from public.combat_tracker ct
  where ct.encounter_id = target_encounter_id;
end;
$$;

create or replace function public.advance_combat_turn(
  target_encounter_id uuid,
  expected_revision bigint
)
returns public.combat_tracker
language plpgsql
security definer
set search_path = public
as $$
declare
  tracker_row public.combat_tracker%rowtype;
  next_tracker public.combat_tracker%rowtype;
  participant_count integer;
  scan_count integer := 0;
  candidate_index integer;
  candidate_participant_id uuid;
  candidate_state text;
  next_round_number integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if not public.is_dm() then
    raise exception 'Only a DM may advance turn order.';
  end if;

  select *
  into tracker_row
  from public.combat_tracker
  where encounter_id = target_encounter_id
  for update;

  if not found then
    raise exception 'Combat tracker not found for encounter %.', target_encounter_id;
  end if;

  if tracker_row.revision <> expected_revision then
    raise exception 'Combat tracker revision mismatch. Expected %, found %.', expected_revision, tracker_row.revision;
  end if;

  participant_count := coalesce(array_length(tracker_row.initiative_order, 1), 0);

  if participant_count = 0 then
    raise exception 'Cannot advance turn order without initiative entries.';
  end if;

  candidate_index := coalesce(tracker_row.active_index, -1);
  next_round_number := tracker_row.round_number;

  loop
    candidate_index := candidate_index + 1;

    if candidate_index >= participant_count then
      candidate_index := 0;

      if tracker_row.active_index is not null then
        next_round_number := next_round_number + 1;
      end if;
    end if;

    candidate_participant_id := tracker_row.initiative_order[candidate_index + 1];

    select state
    into candidate_state
    from public.combat_participants
    where participant_id = candidate_participant_id
      and encounter_id = target_encounter_id;

    if candidate_state = 'active' then
      exit;
    end if;

    scan_count := scan_count + 1;

    if scan_count >= participant_count then
      raise exception 'No active participants are available in the initiative order.';
    end if;
  end loop;

  update public.combat_tracker
  set
    round_number = next_round_number,
    active_participant_id = candidate_participant_id,
    active_index = candidate_index,
    available_standard = 1,
    available_bonus = 1,
    available_move = 1,
    available_reaction = 1,
    available_free = null,
    spent_standard = 0,
    spent_bonus = 0,
    spent_move = 0,
    spent_reaction = 0,
    spent_free = 0,
    turn_started_at = timezone('utc', now())
  where encounter_id = target_encounter_id
  returning *
  into next_tracker;

  return next_tracker;
end;
$$;

revoke all on function public.consume_combat_action(uuid, text, bigint) from public;
grant execute on function public.consume_combat_action(uuid, text, bigint) to authenticated;
grant execute on function public.consume_combat_action(uuid, text, bigint) to service_role;

revoke all on function public.advance_combat_turn(uuid, bigint) from public;
grant execute on function public.advance_combat_turn(uuid, bigint) to authenticated;
grant execute on function public.advance_combat_turn(uuid, bigint) to service_role;
