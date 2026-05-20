-- ============================================================================
-- 0024: Cuma haftalık özet — RPC + pg_cron schedule
-- pg_cron extension'ı enable, generate_weekly_summary fonksiyonu her şirket için
-- son 7 günlük metrikleri toplar, owner_id'ye in_app + push bildirim düşer.
-- ============================================================================

create extension if not exists pg_cron with schema extensions;

create or replace function "filoLocal".generate_weekly_summary()
returns table (company_id uuid, summary jsonb)
language plpgsql security definer
set search_path = public, "filoLocal"
as $$
begin
  return query
  with active as (
    select c.id, c.owner_id, c.name from "filoLocal".companies c
    where c.status = 'active' and c.deleted_at is null
  ),
  metrics as (
    select
      a.id as company_id,
      a.owner_id,
      a.name,
      (select count(*) from "filoLocal".jobs j
        where j.company_id = a.id and j.created_at > now() - interval '7 days') as jobs_total,
      (select count(*) from "filoLocal".jobs j
        where j.company_id = a.id and j.status = 'completed'
          and j.created_at > now() - interval '7 days') as jobs_completed,
      (select count(*) from "filoLocal".jobs j
        where j.company_id = a.id and j.status = 'cancelled'
          and j.created_at > now() - interval '7 days') as jobs_cancelled,
      (select count(distinct cm.user_id)
        from "filoLocal".company_members cm
        where cm.company_id = a.id and cm.role = 'sofor' and cm.is_active and cm.deleted_at is null
      ) as drivers_count,
      (select count(*) from "filoLocal".incidents i
        where i.company_id = a.id and i.created_at > now() - interval '7 days'
          and i.severity in ('high','critical')) as critical_incidents,
      (select count(*) from "filoLocal".vehicle_maintenance vm
        where vm.company_id = a.id
          and vm.expires_at <= current_date + interval '14 days'
          and vm.deleted_at is null) as expiring_documents
    from active a
  )
  select
    m.company_id,
    jsonb_build_object(
      'company_name', m.name,
      'period', jsonb_build_object('from', (now() - interval '7 days')::date, 'to', current_date),
      'jobs', jsonb_build_object(
        'total', m.jobs_total, 'completed', m.jobs_completed, 'cancelled', m.jobs_cancelled
      ),
      'drivers_count', m.drivers_count,
      'critical_incidents', m.critical_incidents,
      'expiring_documents', m.expiring_documents
    )
  from metrics m;
end;
$$;

-- Auto-dispatch: her şirket için owner'a in_app bildirim ekle
create or replace function "filoLocal".dispatch_weekly_summaries()
returns int
language plpgsql security definer
set search_path = public, "filoLocal"
as $$
declare
  v_count int := 0;
  v_row record;
begin
  for v_row in select * from "filoLocal".generate_weekly_summary() loop
    insert into "filoLocal".notifications (
      company_id, user_id, type, channel, status, title, body, data
    )
    select
      v_row.company_id,
      c.owner_id,
      'generic'::"filoLocal".notification_type,
      'in_app'::"filoLocal".notification_channel,
      'queued'::"filoLocal".notification_status,
      '📊 Haftalık özet hazır',
      format('Bu hafta %s iş tamamlandı, %s aktif şoför.',
        coalesce(v_row.summary -> 'jobs' ->> 'completed', '0'),
        coalesce(v_row.summary ->> 'drivers_count', '0')
      ),
      v_row.summary
    from "filoLocal".companies c
    where c.id = v_row.company_id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke execute on function "filoLocal".generate_weekly_summary() from public;
revoke execute on function "filoLocal".dispatch_weekly_summaries() from public;
grant execute on function "filoLocal".generate_weekly_summary() to authenticated;
-- dispatch_weekly_summaries sadece pg_cron'dan çağırılır → grant yok

-- pg_cron schedule: her Cuma 18:00 UTC (TR saati 21:00). İstenirse tz-aware'a alınabilir.
select cron.schedule(
  'drivermesh-weekly-summary',
  '0 18 * * 5',
  $$select "filoLocal".dispatch_weekly_summaries();$$
);;
