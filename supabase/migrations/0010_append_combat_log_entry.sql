create or replace function public.append_combat_log_entry(
  target_encounter_id uuid,
  target_participant_id uuid default null,
  log_message text default null,
  log_payload jsonb default '{}'::jsonb
)
returns public.combat_logs
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_log public.combat_logs%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if not public.is_dm() then
    raise exception 'Only a DM may append combat log entries.';
  end if;

  if log_message is null or btrim(log_message) = '' then
    raise exception 'Combat log message is required.';
  end if;

  insert into public.combat_logs (
    encounter_id,
    participant_id,
    message,
    payload
  )
  values (
    target_encounter_id,
    target_participant_id,
    log_message,
    coalesce(log_payload, '{}'::jsonb)
  )
  returning *
  into inserted_log;

  return inserted_log;
end;
$$;

revoke all on function public.append_combat_log_entry(uuid, uuid, text, jsonb) from public;
grant execute on function public.append_combat_log_entry(uuid, uuid, text, jsonb) to authenticated;
grant execute on function public.append_combat_log_entry(uuid, uuid, text, jsonb) to service_role;
