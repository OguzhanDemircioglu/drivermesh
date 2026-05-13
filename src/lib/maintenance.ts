// ============================================================================
// Maintenance flow lib
// ----------------------------------------------------------------------------
// Bakim talepleri ve aracin bakim state'i icin client orchestration.
//
// Tasarim notlari:
// - Foto upload UI tarafinda yapilir (cloudinary.uploadImage), buraya secureUrl
//   array'i gelir. Reddedilirse / bitirilirse Cloudinary'den destroy edilir.
// - Aktif is kontrolu createMaintenanceRequest + approveMaintenanceRequest'te;
//   race condition'a karsi son gardiyan veritabani UPDATE WHERE status='pending'
//   ile yapilir.
// - Notification helper'i jobs.ts'tekiyle aynidir; paylasilan single-recipient
//   pattern. Coklu hedef (yoneticiler) icin org'da owner+manager listesini cek
//   sonra her birine gonder.
// ============================================================================
import { supabase } from './supabase';
import type {
  Json,
  MaintenanceRequest,
  Profile,
  Vehicle,
} from './database.types';
import { destroyImage, publicIdFromUrl } from './cloudinary';
import { checkPermission } from './permissions';
import { checkPhotoAuthenticity } from './photoAuthenticity';
import { captureException } from './sentry';
import { demo, DEMO_ORG_ID, isDemoActive } from '@/demo/store';
import i18n from '@/i18n';

export type MaintenanceRequestWithRefs = MaintenanceRequest & {
  vehicle: Pick<Vehicle, 'id' | 'plate' | 'brand' | 'model' | 'photo_url'> | null;
  requester: Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'role'> | null;
  decider: Pick<Profile, 'id' | 'full_name'> | null;
};

const SELECT =
  '*, vehicle:vehicles(id,plate,brand,model,photo_url), requester:profiles!maintenance_requests_requester_id_fkey(id,full_name,avatar_url,role), decider:profiles!maintenance_requests_decided_by_fkey(id,full_name)';

function inflate(r: MaintenanceRequest): MaintenanceRequestWithRefs {
  const v = demo.vehicleById(r.vehicle_id);
  const req = demo.profileById(r.requester_id);
  const dec = r.decided_by ? demo.profileById(r.decided_by) : null;
  return {
    ...r,
    vehicle: v
      ? { id: v.id, plate: v.plate, brand: v.brand, model: v.model, photo_url: v.photo_url }
      : null,
    requester: req
      ? { id: req.id, full_name: req.full_name, avatar_url: req.avatar_url, role: req.role }
      : null,
    decider: dec ? { id: dec.id, full_name: dec.full_name } : null,
  };
}

// ----------------------------------------------------------------------------
// Read
// ----------------------------------------------------------------------------

export async function listMaintenanceRequests(
  orgId: string,
  opts?: { onlyPending?: boolean; vehicleId?: string },
): Promise<MaintenanceRequestWithRefs[]> {
  if (isDemoActive()) {
    let list = demo.maintenanceRequests();
    if (opts?.onlyPending) list = list.filter((r) => r.status === 'pending');
    if (opts?.vehicleId) list = list.filter((r) => r.vehicle_id === opts.vehicleId);
    return list.map(inflate);
  }
  let q = supabase
    .from('maintenance_requests')
    .select(SELECT)
    .eq('organization_id', orgId)
    .order('requested_at', { ascending: false });
  if (opts?.onlyPending) q = q.eq('status', 'pending');
  if (opts?.vehicleId) q = q.eq('vehicle_id', opts.vehicleId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as MaintenanceRequestWithRefs[];
}

export async function getMaintenanceRequest(
  id: string,
): Promise<MaintenanceRequestWithRefs | null> {
  if (isDemoActive()) {
    const r = demo.maintenanceRequestById(id);
    return r ? inflate(r) : null;
  }
  const { data, error } = await supabase
    .from('maintenance_requests')
    .select(SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as MaintenanceRequestWithRefs | null;
}

// ----------------------------------------------------------------------------
// Aktif is kontrolu (kural #4: in_progress is varsa bakima alinamaz)
// ----------------------------------------------------------------------------

async function vehicleHasActiveJob(vehicleId: string): Promise<boolean> {
  // assigned + in_progress birlikte "aktif is" sayilir — vehicle detay
  // ekranindaki UI ile ayni davranis. Yetkili UI tarafindan bypass etse bile
  // (deep-link, race) lib gardiyaninda da bloklanir.
  if (isDemoActive()) {
    return demo
      .jobs()
      .some(
        (j) =>
          j.vehicle_id === vehicleId &&
          (j.status === 'assigned' || j.status === 'in_progress'),
      );
  }
  const { data, error } = await supabase
    .from('jobs')
    .select('id')
    .eq('vehicle_id', vehicleId)
    .in('status', ['assigned', 'in_progress'])
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

async function vehiclePlate(vehicleId: string): Promise<string> {
  if (isDemoActive()) return demo.vehicleById(vehicleId)?.plate ?? '—';
  const { data } = await supabase
    .from('vehicles')
    .select('plate')
    .eq('id', vehicleId)
    .maybeSingle();
  return data?.plate ?? '—';
}

export class MaintenanceError extends Error {
  code:
    | 'active_job'
    | 'not_pending'
    | 'not_found'
    | 'forbidden'
    | 'reason_required'
    | 'rejection_reason_required';
  constructor(code: MaintenanceError['code'], message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = 'MaintenanceError';
  }
}

// ----------------------------------------------------------------------------
// Mutations
// ----------------------------------------------------------------------------

export async function createMaintenanceRequest(input: {
  organizationId: string;
  vehicleId: string;
  requesterId: string;
  reason: string;
  photoUrls?: string[];
  estimatedMinutes?: number | null;
}): Promise<MaintenanceRequestWithRefs> {
  const reason = input.reason.trim();
  if (!reason) throw new MaintenanceError('reason_required');

  if (await vehicleHasActiveJob(input.vehicleId)) {
    throw new MaintenanceError('active_job');
  }

  const autoApprove = await checkPermission(
    input.requesterId,
    'vehicles.approve_maintenance',
  );

  const now = new Date().toISOString();
  const baseRow: MaintenanceRequest = {
    id: isDemoActive() ? `demo-mreq-${Date.now()}` : '', // prod'da DB üretir
    organization_id: input.organizationId,
    vehicle_id: input.vehicleId,
    requester_id: input.requesterId,
    reason,
    photo_urls: input.photoUrls ?? [],
    estimated_minutes: input.estimatedMinutes ?? null,
    status: autoApprove ? 'approved' : 'pending',
    decided_by: autoApprove ? input.requesterId : null,
    decided_at: autoApprove ? now : null,
    rejection_reason: null,
    requested_at: now,
  };

  let row: MaintenanceRequest;
  if (isDemoActive()) {
    row = baseRow;
    demo.addMaintenanceRequest(row);
  } else {
    const { data, error } = await supabase
      .from('maintenance_requests')
      .insert({
        organization_id: input.organizationId,
        vehicle_id: input.vehicleId,
        requester_id: input.requesterId,
        reason,
        photo_urls: input.photoUrls ?? [],
        estimated_minutes: input.estimatedMinutes ?? null,
        status: autoApprove ? 'approved' : 'pending',
        decided_by: autoApprove ? input.requesterId : null,
        decided_at: autoApprove ? now : null,
      })
      .select('*')
      .single();
    if (error) throw error;
    row = data;
  }

  const plate = await vehiclePlate(input.vehicleId);
  if (autoApprove) {
    await applyVehicleMaintenanceState({
      vehicleId: input.vehicleId,
      reason,
      photoUrls: input.photoUrls ?? [],
      estimatedMinutes: input.estimatedMinutes ?? null,
      startedBy: input.requesterId,
      startedAt: now,
    });
    await notifyManagers(input.organizationId, input.requesterId, 'maintenance_started', {
      vehicleId: input.vehicleId,
      plate,
      reason,
      requesterId: input.requesterId,
      auto: true,
    });
  } else {
    await notifyManagers(input.organizationId, input.requesterId, 'maintenance_requested', {
      requestId: row.id,
      vehicleId: input.vehicleId,
      plate,
      reason,
    });
  }

  // Foto authenticity check fire-and-forget — UI bekletme. 3 katman
  // (Cloudinary EXIF + HF AI-detector + HF ViT content classifier)
  // 3-15 sn surebilir; sonuc DB row'a yazilir, Patron sonraki tab
  // refresh'inde authenticity badge'leri gorur.
  if (input.photoUrls && input.photoUrls.length > 0 && !isDemoActive()) {
    checkPhotoAuthenticity('maintenance_requests', row.id, input.photoUrls);
  }

  return (await getMaintenanceRequest(row.id))!;
}

export async function approveMaintenanceRequest(
  requestId: string,
  deciderId: string,
): Promise<void> {
  const req = await getMaintenanceRequest(requestId);
  if (!req) throw new MaintenanceError('not_found');
  if (req.status !== 'pending') throw new MaintenanceError('not_pending');
  if (await vehicleHasActiveJob(req.vehicle_id)) {
    throw new MaintenanceError('active_job');
  }

  const now = new Date().toISOString();

  if (isDemoActive()) {
    demo.updateMaintenanceRequest(requestId, {
      status: 'approved',
      decided_by: deciderId,
      decided_at: now,
    });
  } else {
    // Race-safe: UPDATE conditional + rowcount check. Iki manager ayni
    // anda approve cagirirsa sadece biri row'u yakalar; digeri 0 row
    // doner ve buradan donus yapilir — vehicle state bir kere update,
    // notify bir kere gonderilir.
    const { data: updated, error } = await supabase
      .from('maintenance_requests')
      .update({ status: 'approved', decided_by: deciderId, decided_at: now })
      .eq('id', requestId)
      .eq('status', 'pending')
      .select('id');
    if (error) throw error;
    if (!updated || updated.length === 0) {
      // Yarisi kaybedildi — baska biri zaten approve/reject/cancel etti.
      throw new MaintenanceError('not_pending');
    }
  }

  await applyVehicleMaintenanceState({
    vehicleId: req.vehicle_id,
    reason: req.reason,
    photoUrls: req.photo_urls,
    estimatedMinutes: req.estimated_minutes,
    startedBy: deciderId,
    startedAt: now,
  });

  const plate = req.vehicle?.plate ?? '—';
  // notif: talep eden -> 'maintenance_approved'
  await notifyOne(req.organization_id, req.requester_id, deciderId, 'maintenance_approved', {
    requestId,
    vehicleId: req.vehicle_id,
    plate,
    reason: req.reason,
  });
  // notif: yoneticiler -> 'maintenance_started'
  // Requester zaten yukarida 'maintenance_approved' aldi; eger requester de
  // bir manager ise ona 'maintenance_started' tekrar gitmesin.
  await notifyManagers(
    req.organization_id,
    deciderId,
    'maintenance_started',
    {
      vehicleId: req.vehicle_id,
      plate,
      reason: req.reason,
      requesterId: req.requester_id,
      auto: false,
    },
    [req.requester_id],
  );
}

export async function rejectMaintenanceRequest(
  requestId: string,
  deciderId: string,
  rejectionReason: string,
): Promise<void> {
  const reason = rejectionReason.trim();
  if (!reason) throw new MaintenanceError('rejection_reason_required');

  const req = await getMaintenanceRequest(requestId);
  if (!req) throw new MaintenanceError('not_found');
  if (req.status !== 'pending') throw new MaintenanceError('not_pending');

  const now = new Date().toISOString();

  if (isDemoActive()) {
    demo.updateMaintenanceRequest(requestId, {
      status: 'rejected',
      decided_by: deciderId,
      decided_at: now,
      rejection_reason: reason,
    });
  } else {
    const { error } = await supabase
      .from('maintenance_requests')
      .update({
        status: 'rejected',
        decided_by: deciderId,
        decided_at: now,
        rejection_reason: reason,
      })
      .eq('id', requestId)
      .eq('status', 'pending');
    if (error) throw error;
  }

  // Cloudinary foto'larini sil (artik tutmaya gerek yok).
  for (const url of req.photo_urls) {
    const pid = publicIdFromUrl(url);
    if (pid) destroyImage(pid).catch((e) => console.warn('[maintenance] destroy', e));
  }

  await notifyOne(req.organization_id, req.requester_id, deciderId, 'maintenance_rejected', {
    requestId,
    vehicleId: req.vehicle_id,
    plate: req.vehicle?.plate ?? '—',
    reason: req.reason,
    rejectionReason: reason,
  });
}

export async function cancelMaintenanceRequest(
  requestId: string,
  requesterId: string,
): Promise<void> {
  const req = await getMaintenanceRequest(requestId);
  if (!req) throw new MaintenanceError('not_found');
  if (req.status !== 'pending') throw new MaintenanceError('not_pending');
  if (req.requester_id !== requesterId) throw new MaintenanceError('forbidden');

  const now = new Date().toISOString();
  if (isDemoActive()) {
    demo.updateMaintenanceRequest(requestId, {
      status: 'cancelled',
      decided_by: requesterId,
      decided_at: now,
    });
  } else {
    const { error } = await supabase
      .from('maintenance_requests')
      .update({ status: 'cancelled', decided_by: requesterId, decided_at: now })
      .eq('id', requestId)
      .eq('status', 'pending')
      .eq('requester_id', requesterId);
    if (error) throw error;
  }

  // Foto'lari sil — artik kullanilmaz.
  for (const url of req.photo_urls) {
    const pid = publicIdFromUrl(url);
    if (pid) destroyImage(pid).catch((e) => console.warn('[maintenance] destroy', e));
  }
}

export async function endMaintenance(
  vehicleId: string,
  endedBy: string,
  opts?: { auto?: boolean },
): Promise<void> {
  // Mevcut bakim foto'larini Cloudinary'den temizle (DB'den kaldirinca).
  let vehicle: Vehicle | null = null;
  if (isDemoActive()) {
    vehicle = demo.vehicleById(vehicleId);
  } else {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('id', vehicleId)
      .single();
    if (error) throw error;
    vehicle = data;
  }
  if (!vehicle) throw new MaintenanceError('not_found');

  if (isDemoActive()) {
    demo.updateVehicle(vehicleId, {
      status: 'idle',
      maintenance_until: null,
      maintenance_started_at: null,
      maintenance_started_by: null,
      maintenance_reason: null,
      maintenance_photo_urls: [],
    });
  } else {
    const { error } = await supabase
      .from('vehicles')
      .update({
        status: 'idle',
        maintenance_until: null,
        maintenance_started_at: null,
        maintenance_started_by: null,
        maintenance_reason: null,
        maintenance_photo_urls: [],
      })
      .eq('id', vehicleId);
    if (error) throw error;
  }

  // Cloudinary cleanup
  for (const url of vehicle.maintenance_photo_urls ?? []) {
    const pid = publicIdFromUrl(url);
    if (pid) destroyImage(pid).catch((e) => console.warn('[maintenance] destroy', e));
  }

  // Tum org'a 'maintenance_ended' bildirimi
  await notifyOrg(vehicle.organization_id, endedBy, 'maintenance_ended', {
    vehicleId,
    plate: vehicle.plate,
    auto: opts?.auto ?? false,
  });

  // Cikan aracta hala pending bakim talebi varsa ilgili requester'lara hatirlatma
  await remindPendingRequesters(vehicle.organization_id, vehicleId, endedBy, vehicle.plate);
}

// ----------------------------------------------------------------------------
// Internal helpers
// ----------------------------------------------------------------------------

async function applyVehicleMaintenanceState(input: {
  vehicleId: string;
  reason: string;
  photoUrls: string[];
  estimatedMinutes: number | null;
  startedBy: string;
  startedAt: string;
}): Promise<void> {
  const until = input.estimatedMinutes
    ? new Date(Date.parse(input.startedAt) + input.estimatedMinutes * 60_000).toISOString()
    : null;
  const patch = {
    status: 'maintenance' as const,
    maintenance_started_at: input.startedAt,
    maintenance_started_by: input.startedBy,
    maintenance_reason: input.reason,
    maintenance_photo_urls: input.photoUrls,
    maintenance_until: until,
  };
  if (isDemoActive()) {
    demo.updateVehicle(input.vehicleId, patch);
    return;
  }
  const { error } = await supabase.from('vehicles').update(patch).eq('id', input.vehicleId);
  if (error) throw error;
}

async function remindPendingRequesters(
  orgId: string,
  vehicleId: string,
  actorId: string,
  plate: string,
): Promise<void> {
  let pending: { id: string; requester_id: string }[] = [];
  if (isDemoActive()) {
    pending = demo
      .pendingMaintenanceForVehicle(vehicleId)
      .map((r) => ({ id: r.id, requester_id: r.requester_id }));
  } else {
    const { data, error } = await supabase
      .from('maintenance_requests')
      .select('id, requester_id')
      .eq('organization_id', orgId)
      .eq('vehicle_id', vehicleId)
      .eq('status', 'pending');
    if (error) {
      console.warn('[maintenance] pending fetch', error.message);
      return;
    }
    pending = data ?? [];
  }
  // Dedupe: bir driver ayni vehicle icin birden fazla pending talebe sahip
  // olabilir (memory karar #7); her birine ayri push gondermek tekrar olur.
  // Ayni requester'a tek bildirim ver — requestId'yi keep edilen ilki secer.
  const seen = new Set<string>();
  for (const r of pending) {
    if (seen.has(r.requester_id)) continue;
    seen.add(r.requester_id);
    await notifyOne(orgId, r.requester_id, actorId, 'maintenance_pending_reminder', {
      requestId: r.id,
      vehicleId,
      plate,
    });
  }
}

/**
 * Bir tek kullaniciya in-app notification + (varsa) FCM push gonderir.
 * Demo'da Supabase'e + Edge Function'a hic gitmez. Push best-effort:
 * profile.push_token yoksa send-push 'no_token' donerek atlar.
 */
async function notifyOne(
  orgId: string,
  recipientId: string,
  actorId: string | null,
  type: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const json = payload as Json;
  if (isDemoActive()) {
    demo.addNotification({
      id: `demo-n${Math.random().toString(36).slice(2, 10)}`,
      organization_id: orgId,
      recipient_id: recipientId,
      actor_id: actorId,
      type,
      payload: json,
      read_at: null,
      created_at: new Date().toISOString(),
    });
    return;
  }
  const { error } = await supabase.from('notifications').insert({
    organization_id: orgId,
    recipient_id: recipientId,
    actor_id: actorId,
    type,
    payload: json,
  });
  if (error) {
    // Operasyonel gorunurluk — UI eylemi tamamlandi, sadece bildirim
    // sızdı. Sentry'e raporla ki dashboard'tan trend izlenebilsin.
    console.warn('[maintenance] notify failed', error.message);
    captureException(error, { context: 'notify_insert', type, recipientId });
  }

  // FCM push — best effort. push_token yoksa edge function 'no_token' doner.
  // persist:false: notifications insert yukarida lib tarafindan yapildi,
  // send-push duplicate atmasin.
  const push = pushPayloadFor(type, payload);
  if (push) {
    void supabase.functions
      .invoke('send-push', {
        body: {
          recipient_id: recipientId,
          type,
          ...push,
          data: json as Record<string, unknown>,
          persist: false,
        },
      })
      .catch((e) => console.warn('[maintenance] push invoke failed', e));
  }
}

/** Notification tipini push notification baslik/govdesine cevirir. */
function pushPayloadFor(
  type: string,
  payload: Record<string, unknown>,
): { title: string; body?: string } | null {
  const plate = String(payload.plate ?? '');
  const reason = typeof payload.reason === 'string' ? payload.reason : undefined;
  const rej = typeof payload.rejectionReason === 'string' ? payload.rejectionReason : undefined;
  switch (type) {
    case 'maintenance_requested':
      return { title: i18n.t('maintenance.notification.requested', { plate }), body: reason };
    case 'maintenance_approved':
      return { title: i18n.t('maintenance.notification.approved', { plate }) };
    case 'maintenance_rejected':
      return { title: i18n.t('maintenance.notification.rejected', { plate }), body: rej };
    case 'maintenance_started':
      return { title: i18n.t('maintenance.notification.started', { plate }), body: reason };
    case 'maintenance_ended':
      return { title: i18n.t('maintenance.notification.ended', { plate }) };
    case 'maintenance_pending_reminder':
      return { title: i18n.t('maintenance.notification.pendingReminder', { plate }) };
    default:
      return null;
  }
}

async function notifyManagers(
  orgId: string,
  actorId: string,
  type: string,
  payload: Record<string, unknown>,
  /** Actor disinda hariç tutulacak ek kullanicilar (orn. requester'a 'approved'
   * spesifik bildirimi ayrica gonderildi diye 'started' bildiriminden hariç). */
  extraExclude?: string[],
): Promise<void> {
  const exclude = new Set<string>([actorId, ...(extraExclude ?? [])]);
  let recipients: string[] = [];
  if (isDemoActive()) {
    recipients = demo
      .profiles()
      .filter((p) => p.organization_id === DEMO_ORG_ID && (p.role === 'owner' || p.role === 'manager'))
      .filter((p) => !exclude.has(p.id))
      .map((p) => p.id);
  } else {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('organization_id', orgId)
      .in('role', ['owner', 'manager']);
    if (error) {
      console.warn('[maintenance] recipients fetch', error.message);
      return;
    }
    recipients = (data ?? []).map((p) => p.id).filter((id) => !exclude.has(id));
  }
  await Promise.all(recipients.map((rid) => notifyOne(orgId, rid, actorId, type, payload)));
}

async function notifyOrg(
  orgId: string,
  actorId: string,
  type: string,
  payload: Record<string, unknown>,
): Promise<void> {
  let recipients: string[] = [];
  if (isDemoActive()) {
    recipients = demo
      .profiles()
      .filter((p) => p.organization_id === DEMO_ORG_ID)
      .filter((p) => p.id !== actorId)
      .map((p) => p.id);
  } else {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('organization_id', orgId);
    if (error) {
      console.warn('[maintenance] org recipients fetch', error.message);
      return;
    }
    recipients = (data ?? []).map((p) => p.id).filter((id) => id !== actorId);
  }
  await Promise.all(recipients.map((rid) => notifyOne(orgId, rid, actorId, type, payload)));
}
