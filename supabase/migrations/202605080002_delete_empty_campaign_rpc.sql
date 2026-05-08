create or replace function public.delete_empty_campaign(p_campaign_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_campaign_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required to delete a campaign.';
  end if;

  if exists (
    select 1
    from public.game_sessions gs
    where gs.campaign_id = p_campaign_id
  ) then
    raise exception 'Campaign has sessions and cannot be deleted.';
  end if;

  delete from public.campaigns c
  where c.id = p_campaign_id
    and c.owner_user_id = auth.uid()
  returning c.id into deleted_campaign_id;

  if deleted_campaign_id is null then
    raise exception 'Campaign not found or not owned by this account.';
  end if;

  return deleted_campaign_id;
end;
$$;

grant execute on function public.delete_empty_campaign(uuid) to authenticated;

notify pgrst, 'reload schema';
