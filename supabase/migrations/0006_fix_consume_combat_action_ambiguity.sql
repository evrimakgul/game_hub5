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
  from public.combat_tracker as tracker
  where tracker.encounter_id = target_encounter_id
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

  update public.combat_tracker as tracker
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
  where tracker.encounter_id = target_encounter_id;

  return query
  select
    tracker.encounter_id,
    tracker.revision,
    tracker.round_number,
    tracker.active_participant_id,
    tracker.active_index,
    resolved_source,
    resolved_movement,
    resolved_prepared_reaction,
    tracker.available_standard,
    tracker.available_bonus,
    tracker.available_move,
    tracker.available_reaction,
    tracker.available_free,
    tracker.spent_standard,
    tracker.spent_bonus,
    tracker.spent_move,
    tracker.spent_reaction,
    tracker.spent_free,
    tracker.turn_started_at,
    tracker.updated_at
  from public.combat_tracker as tracker
  where tracker.encounter_id = target_encounter_id;
end;
$$;

revoke all on function public.consume_combat_action(uuid, text, bigint) from public;
grant execute on function public.consume_combat_action(uuid, text, bigint) to authenticated;
grant execute on function public.consume_combat_action(uuid, text, bigint) to service_role;
