-- ============================================================================
-- 0023: suggest_drivers_for_job RPC
-- 4 boyutta skor: mesafe (40) + müsaitlik (30) + performans (20) + yük (10)
-- Performans: son 30 gün kabul oranı
-- Yük: bugün aldığı iş sayısı (az olan tercih edilir)
-- ============================================================================

create or replace function "filoLocal".suggest_drivers_for_job(p_job_id uuid)
returns table (
  driver_id uuid,
  full_name text,
  distance_km numeric,
  status "filoLocal".driver_status,
  acceptance_rate numeric,
  jobs_today int,
  score numeric
)
language plpgsql security definer
set search_path = public, "filoLocal"
as $$
declare
  v_user uuid := auth.uid();
  v_job "filoLocal".jobs;
begin
  if v_user is null then raise exception 'unauthorized' using errcode='42501'; end if;

  select * into v_job from "filoLocal".jobs where id = p_job_id;
  if v_job.id is null then raise exception 'job_not_found' using errcode='P0002'; end if;

  if not exists (
    select 1 from "filoLocal".company_members cm
    where cm.user_id = v_user and cm.company_id = v_job.company_id
      and cm.role in ('patron','mudur') and cm.is_active and cm.deleted_at is null
  ) then raise exception 'forbidden' using errcode='42501'; end if;

  return query
  with drivers as (
    select
      cm.user_id as did,
      u.full_name as fname,
      ds.status as dstatus,
      ds.last_lat,
      ds.last_lng
    from "filoLocal".company_members cm
    join "filoLocal".users u on u.id = cm.user_id and u.deleted_at is null
    left join "filoLocal".driver_statuses ds on ds.driver_id = cm.user_id
    where cm.company_id = v_job.company_id
      and cm.role in ('sofor')
      and cm.is_active and cm.deleted_at is null
  ),
  recent as (
    select
      j.driver_id as did,
      count(*) filter (where j.status in ('accepted','in_progress','completed')) as accepted,
      count(*) filter (where j.status in ('rejected','cancelled')) as refused,
      count(*) as total
    from "filoLocal".jobs j
    where j.company_id = v_job.company_id
      and j.created_at > now() - interval '30 days'
    group by j.driver_id
  ),
  today_load as (
    select j.driver_id as did, count(*) as cnt
    from "filoLocal".jobs j
    where j.company_id = v_job.company_id
      and j.created_at::date = current_date
      and j.driver_id is not null
    group by j.driver_id
  ),
  combined as (
    select
      d.did,
      d.fname,
      d.dstatus,
      -- Haversine yaklaşımı: cos(lat) sabit varsayım, küçük şehir mesafelerinde yeterli
      case
        when d.last_lat is null or d.last_lng is null then null
        else sqrt(
          power((d.last_lat - v_job.pickup_lat) * 111.0, 2) +
          power((d.last_lng - v_job.pickup_lng) * 111.0 * cos(radians(v_job.pickup_lat)), 2)
        )::numeric
      end as dist_km,
      coalesce(r.accepted::numeric / nullif(r.total, 0), 0.5) as accept_rate,
      coalesce(t.cnt, 0)::int as today_cnt
    from drivers d
    left join recent r on r.did = d.did
    left join today_load t on t.did = d.did
  )
  select
    c.did,
    c.fname,
    round(c.dist_km, 2) as distance_km,
    coalesce(c.dstatus, 'offline'::"filoLocal".driver_status) as status,
    round(c.accept_rate, 2) as acceptance_rate,
    c.today_cnt,
    round(
      -- Mesafe (40 puan): 0 km=40, >25km=0
      case
        when c.dist_km is null then 10
        when c.dist_km > 25 then 0
        else 40 * (1 - (c.dist_km / 25.0))
      end
      -- Müsaitlik (30): available=30, on_break/invisible=15, busy/on_leave=0, offline=5
      + case coalesce(c.dstatus, 'offline')
          when 'available' then 30
          when 'on_break' then 15
          when 'invisible' then 15
          when 'busy' then 0
          when 'on_leave' then 0
          else 5
        end
      -- Performans (20)
      + 20 * c.accept_rate
      -- Yük (10): bugün 0 iş=10, 5+ iş=0
      + greatest(0, 10 - 2 * c.today_cnt),
    1) as score
  from combined c
  order by score desc
  limit 5;
end;
$$;

revoke execute on function "filoLocal".suggest_drivers_for_job(uuid) from public;
grant execute on function "filoLocal".suggest_drivers_for_job(uuid) to authenticated;;
