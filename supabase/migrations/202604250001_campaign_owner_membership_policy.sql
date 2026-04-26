create or replace function public.is_campaign_owner(target_campaign_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.campaigns c
    where c.id = target_campaign_id
      and c.owner_user_id = auth.uid()
  );
$$;

drop policy if exists campaign_members_owner_insert on public.campaign_members;

create policy campaign_members_owner_insert
  on public.campaign_members for insert to authenticated
  with check (
    user_id = auth.uid()
    and role = 'dm'
    and public.is_campaign_owner(campaign_id)
  );

notify pgrst, 'reload schema';
