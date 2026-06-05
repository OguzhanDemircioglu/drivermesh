-- fleet_plan_status()'a promo bilgisi ekle.
-- "İlk 20 kullanıcı" tanıtım kotası: ödeme key'leri gelene kadar, limite ulaşan
-- ilk 20 organizasyon planını UYGULAMA İÇİNDE ÜCRETSİZ yükseltebilir (sandbox).
-- (Ücretsiz promo = para hareketi yok → Google Play Billing politikasına takılmaz.)
--
-- promo_remaining : kalan ücretsiz yükseltme hakkı (20 - şimdiye dek promo'lu org).
-- org_is_promo    : bu org zaten promo ile mi yükseltildi (tekrar consume etmesin).

create or replace function public.fleet_plan_status()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id    uuid := auth.uid();
  v_org        uuid;
  v_plan       public.fleet_plan;
  v_status     text;
  v_renews     timestamptz;
  v_provider   text;
  v_limit      integer;
  v_count      integer;
  v_promo_used integer;
  c_promo_limit constant integer := 20;
begin
  if caller_id is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;

  select organization_id into v_org from public.profiles where id = caller_id;
  if v_org is null then
    return jsonb_build_object(
      'plan', 'free', 'status', 'active', 'vehicle_count', 0,
      'limit', 3, 'can_add', false, 'no_org', true,
      'promo_remaining', 0, 'org_is_promo', false
    );
  end if;

  select plan, plan_status, plan_renews_at, plan_provider
    into v_plan, v_status, v_renews, v_provider
    from public.organizations where id = v_org;

  v_limit := public.fleet_plan_vehicle_limit(v_plan);

  select count(*) into v_count
    from public.vehicles where organization_id = v_org;

  -- Şimdiye dek promo (ücretsiz/sandbox) ile yükseltilmiş org sayısı.
  select count(*) into v_promo_used
    from public.organizations
   where plan <> 'free' and plan_provider = 'sandbox';

  return jsonb_build_object(
    'plan',            v_plan,
    'status',          v_status,
    'renews_at',       v_renews,
    'vehicle_count',   v_count,
    'limit',           v_limit,                                   -- null = sınırsız
    'can_add',         (v_limit is null or v_count < v_limit),
    'promo_remaining', greatest(0, c_promo_limit - v_promo_used),
    'org_is_promo',    (v_plan <> 'free' and v_provider = 'sandbox')
  );
end;
$$;

revoke all on function public.fleet_plan_status() from public;
grant execute on function public.fleet_plan_status() to authenticated;
