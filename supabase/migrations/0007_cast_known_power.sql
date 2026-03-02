create or replace function public.cast_known_power(
  target_character_id uuid,
  target_power_id text,
  target_encounter_id uuid default null,
  expected_revision bigint default null
)
returns table (
  power_id text,
  power_level integer,
  mana_spent integer,
  current_mana integer,
  character_status_effect_id uuid,
  status_effect_id text,
  status_label text,
  consumed_from text,
  encounter_id uuid,
  encounter_revision bigint,
  available_standard integer,
  available_bonus integer,
  available_move integer,
  available_reaction integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  known_power_level integer;
  character_row public.characters%rowtype;
  updated_character public.characters%rowtype;
  existing_status_effect_id uuid;
  action_request text := null;
  mana_cost integer := 0;
  resolved_status_effect_id text;
  resolved_status_label text;
  resolved_effects jsonb := '[]'::jsonb;
  resolved_payload jsonb := '{}'::jsonb;
  action_consumed_from text := null;
  action_encounter_revision bigint := null;
  action_available_standard integer := null;
  action_available_bonus integer := null;
  action_available_move integer := null;
  action_available_reaction integer := null;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if not public.is_dm() and not public.owns_character(target_character_id) then
    raise exception 'Only the owning player or a DM may cast powers for this character.';
  end if;

  select *
  into character_row
  from public.characters
  where character_id = target_character_id;

  select level
  into known_power_level
  from public.character_known_powers
  where character_id = target_character_id
    and power_id = target_power_id;

  if character_row.character_id is null or known_power_level is null then
    raise exception 'Character % does not know power %.', target_character_id, target_power_id;
  end if;

  case target_power_id
    when 'light_support' then
      action_request := 'standard';
      resolved_status_effect_id := 'light_support';
      resolved_status_label := 'Light Support';
      resolved_payload := jsonb_build_object(
        'power_id', target_power_id,
        'power_level', known_power_level,
        'duration_text', case
          when known_power_level >= 5 then '60 minutes outside portals or 1 portal duration'
          when known_power_level >= 4 then '30 minutes outside portals or 1 portal duration'
          else '10 minutes or 1 portal duration'
        end,
        'aura_range_meters', 25,
        'grants_nightvision', true
      );

      case
        when known_power_level >= 5 then
          mana_cost := 4;
          resolved_effects := jsonb_build_array(
            jsonb_build_object(
              'id', 'power.light_support.hit_bonus',
              'kind', 'modifier',
              'label', 'Light Support Hit Bonus',
              'timing', 'passive',
              'target', jsonb_build_object('scope', 'self', 'attribute', 'attack_dice_pool_hit_bonus'),
              'duration', jsonb_build_object('kind', 'until_removed'),
              'modifierType', 'flat',
              'value', 4,
              'stacking', 'refresh'
            ),
            jsonb_build_object(
              'id', 'power.light_support.damage_reduction',
              'kind', 'modifier',
              'label', 'Light Support Damage Reduction',
              'timing', 'passive',
              'target', jsonb_build_object('scope', 'self', 'attribute', 'damage_reduction'),
              'duration', jsonb_build_object('kind', 'until_removed'),
              'modifierType', 'flat',
              'value', 2,
              'stacking', 'refresh'
            ),
            jsonb_build_object(
              'id', 'power.light_support.soak',
              'kind', 'modifier',
              'label', 'Light Support Soak',
              'timing', 'passive',
              'target', jsonb_build_object('scope', 'self', 'attribute', 'soak'),
              'duration', jsonb_build_object('kind', 'until_removed'),
              'modifierType', 'flat',
              'value', 2,
              'stacking', 'refresh'
            )
          );
          resolved_payload := resolved_payload || jsonb_build_object(
            'expose_darkness', true,
            'removes_darkness_resistances', true
          );
        when known_power_level = 4 then
          mana_cost := 3;
          resolved_effects := jsonb_build_array(
            jsonb_build_object(
              'id', 'power.light_support.hit_bonus',
              'kind', 'modifier',
              'label', 'Light Support Hit Bonus',
              'timing', 'passive',
              'target', jsonb_build_object('scope', 'self', 'attribute', 'attack_dice_pool_hit_bonus'),
              'duration', jsonb_build_object('kind', 'until_removed'),
              'modifierType', 'flat',
              'value', 3,
              'stacking', 'refresh'
            ),
            jsonb_build_object(
              'id', 'power.light_support.damage_reduction',
              'kind', 'modifier',
              'label', 'Light Support Damage Reduction',
              'timing', 'passive',
              'target', jsonb_build_object('scope', 'self', 'attribute', 'damage_reduction'),
              'duration', jsonb_build_object('kind', 'until_removed'),
              'modifierType', 'flat',
              'value', 2,
              'stacking', 'refresh'
            ),
            jsonb_build_object(
              'id', 'power.light_support.soak',
              'kind', 'modifier',
              'label', 'Light Support Soak',
              'timing', 'passive',
              'target', jsonb_build_object('scope', 'self', 'attribute', 'soak'),
              'duration', jsonb_build_object('kind', 'until_removed'),
              'modifierType', 'flat',
              'value', 1,
              'stacking', 'refresh'
            )
          );
          resolved_payload := resolved_payload || jsonb_build_object('mana_restoration_support', true);
        when known_power_level = 3 then
          mana_cost := 3;
          resolved_effects := jsonb_build_array(
            jsonb_build_object(
              'id', 'power.light_support.hit_bonus',
              'kind', 'modifier',
              'label', 'Light Support Hit Bonus',
              'timing', 'passive',
              'target', jsonb_build_object('scope', 'self', 'attribute', 'attack_dice_pool_hit_bonus'),
              'duration', jsonb_build_object('kind', 'until_removed'),
              'modifierType', 'flat',
              'value', 3,
              'stacking', 'refresh'
            ),
            jsonb_build_object(
              'id', 'power.light_support.damage_reduction',
              'kind', 'modifier',
              'label', 'Light Support Damage Reduction',
              'timing', 'passive',
              'target', jsonb_build_object('scope', 'self', 'attribute', 'damage_reduction'),
              'duration', jsonb_build_object('kind', 'until_removed'),
              'modifierType', 'flat',
              'value', 1,
              'stacking', 'refresh'
            ),
            jsonb_build_object(
              'id', 'power.light_support.soak',
              'kind', 'modifier',
              'label', 'Light Support Soak',
              'timing', 'passive',
              'target', jsonb_build_object('scope', 'self', 'attribute', 'soak'),
              'duration', jsonb_build_object('kind', 'until_removed'),
              'modifierType', 'flat',
              'value', 1,
              'stacking', 'refresh'
            )
          );
        when known_power_level = 2 then
          mana_cost := 2;
          resolved_effects := jsonb_build_array(
            jsonb_build_object(
              'id', 'power.light_support.hit_bonus',
              'kind', 'modifier',
              'label', 'Light Support Hit Bonus',
              'timing', 'passive',
              'target', jsonb_build_object('scope', 'self', 'attribute', 'attack_dice_pool_hit_bonus'),
              'duration', jsonb_build_object('kind', 'until_removed'),
              'modifierType', 'flat',
              'value', 2,
              'stacking', 'refresh'
            ),
            jsonb_build_object(
              'id', 'power.light_support.damage_reduction',
              'kind', 'modifier',
              'label', 'Light Support Damage Reduction',
              'timing', 'passive',
              'target', jsonb_build_object('scope', 'self', 'attribute', 'damage_reduction'),
              'duration', jsonb_build_object('kind', 'until_removed'),
              'modifierType', 'flat',
              'value', 1,
              'stacking', 'refresh'
            )
          );
          resolved_payload := resolved_payload || jsonb_build_object('hidden_from_hostiles', true);
        else
          mana_cost := 2;
          resolved_effects := jsonb_build_array(
            jsonb_build_object(
              'id', 'power.light_support.hit_bonus',
              'kind', 'modifier',
              'label', 'Light Support Hit Bonus',
              'timing', 'passive',
              'target', jsonb_build_object('scope', 'self', 'attribute', 'attack_dice_pool_hit_bonus'),
              'duration', jsonb_build_object('kind', 'until_removed'),
              'modifierType', 'flat',
              'value', 2,
              'stacking', 'refresh'
            )
          );
      end case;
    else
      raise exception 'Power % is not yet supported for live casting.', target_power_id;
  end case;

  if character_row.current_mana < mana_cost then
    raise exception 'Not enough mana to cast %. Needed %, current %.', target_power_id, mana_cost, character_row.current_mana;
  end if;

  if target_encounter_id is not null and action_request is not null then
    if expected_revision is null then
      raise exception 'An encounter revision is required when casting % during combat.', target_power_id;
    end if;

    select
      action_result.consumed_from,
      action_result.revision,
      action_result.available_standard,
      action_result.available_bonus,
      action_result.available_move,
      action_result.available_reaction
    into
      action_consumed_from,
      action_encounter_revision,
      action_available_standard,
      action_available_bonus,
      action_available_move,
      action_available_reaction
    from public.consume_combat_action(
      target_encounter_id,
      action_request,
      expected_revision
    ) as action_result;
  end if;

  update public.characters
  set current_mana = current_mana - mana_cost
  where character_id = target_character_id
  returning *
  into updated_character;

  select cse.character_status_effect_id
  into existing_status_effect_id
  from public.character_status_effects cse
  where cse.character_id = target_character_id
    and cse.source_type = 'power'
    and cse.source_id = target_power_id
    and cse.status_effect_id = resolved_status_effect_id
  order by cse.created_at asc
  limit 1;

  if existing_status_effect_id is null then
    insert into public.character_status_effects (
      character_id,
      status_effect_id,
      label,
      source_type,
      source_id,
      stacks,
      applied_at,
      expires_at,
      remaining_rounds,
      effects,
      payload
    )
    values (
      target_character_id,
      resolved_status_effect_id,
      resolved_status_label,
      'power',
      target_power_id,
      1,
      timezone('utc', now()),
      null,
      null,
      resolved_effects,
      resolved_payload
    )
    returning character_status_effect_id
    into existing_status_effect_id;
  else
    update public.character_status_effects
    set
      label = resolved_status_label,
      stacks = 1,
      applied_at = timezone('utc', now()),
      expires_at = null,
      remaining_rounds = null,
      effects = resolved_effects,
      payload = resolved_payload
    where character_status_effect_id = existing_status_effect_id;
  end if;

  return query
  select
    target_power_id,
    known_power_level,
    mana_cost,
    updated_character.current_mana,
    existing_status_effect_id,
    resolved_status_effect_id,
    resolved_status_label,
    action_consumed_from,
    target_encounter_id,
    action_encounter_revision,
    action_available_standard,
    action_available_bonus,
    action_available_move,
    action_available_reaction;
end;
$$;

revoke all on function public.cast_known_power(uuid, text, uuid, bigint) from public;
grant execute on function public.cast_known_power(uuid, text, uuid, bigint) to authenticated;
grant execute on function public.cast_known_power(uuid, text, uuid, bigint) to service_role;
