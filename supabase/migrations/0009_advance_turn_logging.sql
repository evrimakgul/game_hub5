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
  candidate_display_name text;
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

    select state, display_name
    into candidate_state, candidate_display_name
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

  insert into public.combat_logs (
    encounter_id,
    participant_id,
    message,
    payload
  )
  values (
    target_encounter_id,
    candidate_participant_id,
    format('Round %s: %s starts their turn.', next_tracker.round_number, coalesce(candidate_display_name, 'Unknown combatant')),
    jsonb_build_object(
      'event', 'turn_advanced',
      'round_number', next_tracker.round_number,
      'participant_id', candidate_participant_id,
      'active_index', candidate_index
    )
  );

  return next_tracker;
end;
$$;

revoke all on function public.advance_combat_turn(uuid, bigint) from public;
grant execute on function public.advance_combat_turn(uuid, bigint) to authenticated;
grant execute on function public.advance_combat_turn(uuid, bigint) to service_role;
