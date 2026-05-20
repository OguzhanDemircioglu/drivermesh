create or replace function public.notify_driver_request()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_requester_name text;
begin
  -- Only fire for the driver-self-request channel sitting in 'open'
  -- (the approval-pending state). Internal/ride jobs and reassignments
  -- don't need to ping staff this way.
  if new.source <> 'driver_request' then
    return new;
  end if;
  if new.status <> 'open' then
    return new;
  end if;

  select full_name into v_requester_name
  from public.profiles where id = new.created_by;

  -- Fan out to every owner + manager in the org. We skip the requester
  -- themselves (which would only matter if they're somehow staff, but
  -- be safe) and rely on the existing notifications RLS policies.
  insert into public.notifications
    (organization_id, recipient_id, actor_id, type, payload)
  select
    new.organization_id,
    p.id,
    new.created_by,
    'driver_request',
    jsonb_build_object(
      'job_id', new.id,
      'requester_id', new.created_by,
      'requester_name', coalesce(v_requester_name, 'Bir şoför'),
      'customer_name', new.customer_name,
      'pickup_address', new.pickup_address,
      'dropoff_address', new.dropoff_address
    )
  from public.profiles p
  where p.organization_id = new.organization_id
    and p.role in ('owner', 'manager')
    and p.id <> new.created_by;

  return new;
end;
$$;

drop trigger if exists notify_driver_request_after_insert on public.jobs;
create trigger notify_driver_request_after_insert
  after insert on public.jobs
  for each row
  execute function public.notify_driver_request();;
