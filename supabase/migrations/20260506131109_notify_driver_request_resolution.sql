create or replace function public.notify_driver_request_resolution()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_actor uuid;
  v_type text;
begin
  -- Only fire when an originally-pending driver_request gets resolved
  -- (open + null driver → assigned, OR open → cancelled).
  if old.source <> 'driver_request' then
    return new;
  end if;
  if old.status <> 'open' then
    return new;
  end if;
  if old.driver_id is not null then
    return new;
  end if;

  if new.status = 'assigned' and new.driver_id = old.created_by then
    v_type := 'request_approved';
  elsif new.status = 'cancelled' then
    v_type := 'request_rejected';
  else
    -- Some other reassignment path — out of scope for this trigger.
    return new;
  end if;

  -- The actor is whoever just took the action. We can't know that
  -- definitively from a trigger, so we use auth.uid() (the JWT-bound
  -- caller) and fall back to null if not present.
  begin
    v_actor := auth.uid();
  exception when others then
    v_actor := null;
  end;

  insert into public.notifications
    (organization_id, recipient_id, actor_id, type, payload)
  values (
    new.organization_id,
    old.created_by,
    v_actor,
    v_type,
    jsonb_build_object(
      'job_id', new.id,
      'customer_name', new.customer_name,
      'pickup_address', new.pickup_address,
      'dropoff_address', new.dropoff_address
    )
  );

  return new;
end;
$$;

drop trigger if exists notify_driver_request_resolution_after_update on public.jobs;
create trigger notify_driver_request_resolution_after_update
  after update on public.jobs
  for each row
  execute function public.notify_driver_request_resolution();;
