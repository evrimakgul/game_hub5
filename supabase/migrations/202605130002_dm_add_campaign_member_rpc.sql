create or replace function public.add_campaign_member(
  p_campaign_id uuid,
  p_user_id uuid,
  p_role text default 'player',
  p_display_name text default '',
  p_selected_character_id text default null
)
returns public.campaign_members
language plpgsql
security definer
set search_path = public
as $$
declare
  campaign_record public.campaigns%rowtype;
  joined_member public.campaign_members%rowtype;
  resolved_role text;
  resolved_display_name text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required to add a campaign member.';
  end if;

  select * into campaign_record
  from public.campaigns
  where id = p_campaign_id;

  if campaign_record.id is null then
    raise exception 'Campaign not found.';
  end if;

  if not public.is_campaign_dm(p_campaign_id) then
    raise exception 'Only campaign DMs can add campaign members.';
  end if;

  resolved_role := case when p_role = 'dm' then 'dm' else 'player' end;
  resolved_display_name := coalesce(nullif(trim(p_display_name), ''), p_user_id::text);

  if campaign_record.game_id is not null then
    insert into public.game_members (game_id, user_id, role, display_name)
    values (campaign_record.game_id, p_user_id, resolved_role, resolved_display_name)
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
  values (
    p_campaign_id,
    p_user_id,
    resolved_role,
    resolved_display_name,
    p_selected_character_id
  )
  on conflict (campaign_id, user_id) do update
  set role = excluded.role,
      display_name = excluded.display_name,
      selected_character_id = excluded.selected_character_id
  returning * into joined_member;

  return joined_member;
end;
$$;

grant execute on function public.add_campaign_member(uuid, uuid, text, text, text) to authenticated;

notify pgrst, 'reload schema';
