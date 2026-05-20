alter table public.vehicles
  add column if not exists is_at_hq boolean not null default false;

-- When a vehicle gets dispatched (job vehicle_id set), it's no longer at HQ.
-- The trigger auto-clears the flag so the map and the detail button
-- reflect reality without needing the operator to remember to unmark it.
create or replace function public.clear_at_hq_on_dispatch()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.vehicle_id is not null
    and (tg_op = 'INSERT' or old.vehicle_id is distinct from new.vehicle_id)
  then
    update public.vehicles
      set is_at_hq = false
      where id = new.vehicle_id;
  end if;
  return new;
end;
$$;

drop trigger if exists clear_at_hq_on_job_assignment on public.jobs;
create trigger clear_at_hq_on_job_assignment
  after insert or update of vehicle_id on public.jobs
  for each row
  execute function public.clear_at_hq_on_dispatch();;
