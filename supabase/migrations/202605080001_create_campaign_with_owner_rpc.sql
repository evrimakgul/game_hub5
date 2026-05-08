create or replace function public.create_campaign_with_owner(
  p_campaign_name text,
  p_owner_display_name text default 'Dungeon Master'
)
returns table (
  campaign_id uuid,
  campaign_name text,
  owner_user_id uuid,
  campaign_created_at timestamptz,
  member_user_id uuid,
  member_role text,
  member_display_name text,
  member_selected_character_id text,
  member_joined_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  new_campaign public.campaigns%rowtype;
  new_member public.campaign_members%rowtype;
  resolved_display_name text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required to create a campaign.';
  end if;

  resolved_display_name := coalesce(nullif(trim(p_owner_display_name), ''), 'Dungeon Master');

  insert into public.campaigns (name, owner_user_id)
  values (coalesce(nullif(trim(p_campaign_name), ''), 'Convergence Campaign'), auth.uid())
  returning * into new_campaign;

  insert into public.campaign_members (
    campaign_id,
    user_id,
    role,
    display_name,
    selected_character_id
  )
  values (
    new_campaign.id,
    auth.uid(),
    'dm',
    resolved_display_name,
    null
  )
  returning * into new_member;

  return query
  select
    new_campaign.id,
    new_campaign.name,
    new_campaign.owner_user_id,
    new_campaign.created_at,
    new_member.user_id,
    new_member.role,
    new_member.display_name,
    new_member.selected_character_id,
    new_member.joined_at;
end;
$$;

grant execute on function public.create_campaign_with_owner(text, text) to authenticated;

notify pgrst, 'reload schema';
