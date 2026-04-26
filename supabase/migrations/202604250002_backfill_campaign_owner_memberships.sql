insert into public.campaign_members (
  campaign_id,
  user_id,
  role,
  display_name,
  selected_character_id
)
select
  c.id,
  c.owner_user_id,
  'dm',
  coalesce(nullif(p.display_name, ''), 'Dungeon Master'),
  null
from public.campaigns c
left join public.profiles p on p.id = c.owner_user_id
where not exists (
  select 1
  from public.campaign_members cm
  where cm.campaign_id = c.id
    and cm.user_id = c.owner_user_id
);

notify pgrst, 'reload schema';
