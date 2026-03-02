create or replace function public.set_character_resources(
  target_character_id uuid,
  next_current_hp integer,
  next_current_mana integer
)
returns public.characters
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_character public.characters%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if next_current_hp < 0 or next_current_mana < 0 then
    raise exception 'Current HP and current Mana must be non-negative.';
  end if;

  if not public.is_dm() and not public.owns_character(target_character_id) then
    raise exception 'Only the owning player or a DM may update these resources.';
  end if;

  update public.characters
  set
    current_hp = next_current_hp,
    current_mana = next_current_mana
  where character_id = target_character_id
  returning *
  into updated_character;

  if not found then
    raise exception 'Character % was not found.', target_character_id;
  end if;

  return updated_character;
end;
$$;

create or replace function public.set_inventory_item_slot(
  target_item_instance_id uuid,
  target_equipped_slot text
)
returns public.inventory_items
language plpgsql
security definer
set search_path = public
as $$
declare
  target_item public.inventory_items%rowtype;
  updated_item public.inventory_items%rowtype;
  compatible_slots text[];
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if target_equipped_slot is not null
    and target_equipped_slot <> all (
      array['head', 'neck', 'body', 'right_hand', 'left_hand', 'ring_right', 'ring_left']::text[]
    ) then
    raise exception 'Unsupported equipment slot: %.', target_equipped_slot;
  end if;

  select *
  into target_item
  from public.inventory_items
  where item_instance_id = target_item_instance_id
  for update;

  if not found then
    raise exception 'Inventory item % was not found.', target_item_instance_id;
  end if;

  if not public.is_dm() and not public.owns_character(target_item.owner_character_id) then
    raise exception 'Only the owning player or a DM may equip this item.';
  end if;

  if target_equipped_slot is not null then
    select slot_compatibility
    into compatible_slots
    from public.item_templates
    where item_template_id = target_item.template_id;

    if compatible_slots is null or not (target_equipped_slot = any (compatible_slots)) then
      raise exception 'Item % cannot be equipped in slot %.', target_item.template_id, target_equipped_slot;
    end if;

    update public.inventory_items
    set equipped_slot = null
    where owner_character_id = target_item.owner_character_id
      and equipped_slot = target_equipped_slot
      and item_instance_id <> target_item_instance_id;
  end if;

  update public.inventory_items
  set equipped_slot = target_equipped_slot
  where item_instance_id = target_item_instance_id
  returning *
  into updated_item;

  return updated_item;
end;
$$;

revoke all on function public.set_character_resources(uuid, integer, integer) from public;
grant execute on function public.set_character_resources(uuid, integer, integer) to authenticated;
grant execute on function public.set_character_resources(uuid, integer, integer) to service_role;

revoke all on function public.set_inventory_item_slot(uuid, text) from public;
grant execute on function public.set_inventory_item_slot(uuid, text) to authenticated;
grant execute on function public.set_inventory_item_slot(uuid, text) to service_role;
