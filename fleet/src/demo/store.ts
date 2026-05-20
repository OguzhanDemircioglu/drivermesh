/**
 * Demo store. Activated when AuthProvider.signInDemo() runs.
 *
 * The lib/ data layer checks `isDemoActive()` at the top of every
 * query/mutation and short-circuits to this store instead of hitting
 * Supabase.
 *
 * **Persistence:** the seed function (`reseed`) plays the role of a "DB"
 * that runs once on first activation; afterwards the entire state is
 * mirrored to AsyncStorage under DEMO_STATE_KEY. Subsequent activations
 * load from disk so demo mutations (avatar uploads, job state changes,
 * permission overrides, …) survive app kills. `clearDemoStorage()` wipes
 * the disk copy — call it from the explicit "delete fleet" action so the
 * next sign-in re-seeds.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  Invitation,
  Job,
  JobSource,
  JobStatus,
  MaintenanceRequest,
  Notification,
  Profile,
  UserRole,
  Vehicle,
} from '@/lib/database.types';
import type { MemberPermission } from '@/lib/permissions';

// v2: profile seed'i artık avatar_url içeriyor (pravatar.cc CDN). v1
// kalıntıları devre dışı bırakıldığı için kullanıcı uygulamayı bir
// kere açtığında yeni seed otomatik gelir; eski saved state diskte
// orphan kalır, GC'lenmez ama okunmaz.
// v3: vehicle seed gucleristirildi (maintenance state dolu, current_user_id
// claim ornekleri) + maintenanceRequests history seed (5 status with
// 3 authenticity scenarios in v4).
// v5 (2026-05-18): seed zenginleştirildi — 7 araç, 10 iş, 6 profile,
// 5 notification.
// v6 (2026-05-18): iş kuralına uyum — vehicles_set_default_owner trigger'a
// göre HİÇBİR araç sahipsiz kalmaz (idle olsa bile current_user_id =
// owner). Demo'da idle iki araç (demo-v5 Renault Master + demo-v7 Peugeot
// Boxer) artık Demo Patron üzerinde. "Üzerine Al" akışı için yine başka
// driver kendine alabilir.
// v7 (2026-05-18): profile.status enum demo'da seed edildi — Ahmet/Burak
// on_trip, Mehmet break, Ayşe active, owner+manager active. StatusPill
// pill ve ride_search_vehicles filter'ları için artık zengin data var.
const DEMO_STATE_KEY = 'drivermesh.demo.state.v7';

// ---------- IDs ----------

export const DEMO_ORG_ID = 'demo-org';
export const DEMO_OWNER_ID = 'demo-owner';
export const DEMO_MANAGER_ID = 'demo-mgr';
export const DEMO_DRIVER_IDS = ['demo-d1', 'demo-d2', 'demo-d3', 'demo-d4', 'demo-d5'] as const;

// ---------- Helpers ----------

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const hoursAgo = (h: number) => minutesAgo(h * 60);

// ---------- Debounced disk save ----------

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function emit() {
  // Persistence — every state mutation routes through emit(); we coalesce
  // rapid bursts (e.g. driver-position updates, multi-field form save) into
  // a single AsyncStorage write to avoid I/O thrash.
  if (_active) {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      saveToDisk().catch(() => {
        /* swallow — disk persistence is best-effort, in-memory is canonical */
      });
    }, 250);
  }
}

// ---------- Active flag + activation/deactivation ----------

let _active = false;
export function isDemoActive(): boolean {
  return _active;
}

/**
 * Activate demo mode. First call after a fresh install hits the "DB" (the
 * `reseed` function) once and writes the result to AsyncStorage. Every
 * subsequent activation hydrates state from AsyncStorage so demo
 * mutations survive app restarts. `signInDemo` in AuthProvider awaits
 * this so UI doesn't render a stale-empty state on cold launch.
 */
export async function activateDemo(): Promise<void> {
  _active = true;
  const loaded = await loadFromDisk();
  if (!loaded) {
    reseed();
    // First-ever activation — push the seed to disk so next launch reads
    // exactly what the user is about to see (no double "DB" hit).
    await saveToDisk().catch(() => {});
  }
  emit();
}

export function deactivateDemo() {
  _active = false;
  // NOTE: disk state is intentionally KEPT — signing back into demo
  // brings the user to the same state they left. To reset, call
  // `clearDemoStorage()` (deleteFleet does this).
  emit();
}

/** Wipe the persisted demo state. Next `activateDemo()` re-seeds from scratch. */
export async function clearDemoStorage(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DEMO_STATE_KEY);
  } catch {
    /* ignore */
  }
}

// ---------- Disk persistence ----------

type SerializedState = {
  hq: Hq | null;
  profiles: Profile[];
  vehicles: Vehicle[];
  jobs: Job[];
  invitations: Invitation[];
  notifications: Notification[];
  maintenanceRequests: MaintenanceRequest[];
  // Map<string, Map<string, boolean>> → nested plain objects
  permissionOverrides: Record<string, Record<string, boolean>>;
  feedbackChannels: FeedbackChannels;
};

async function saveToDisk(): Promise<void> {
  const overridesObj: Record<string, Record<string, boolean>> = {};
  for (const [memberId, perms] of state.permissionOverrides.entries()) {
    overridesObj[memberId] = Object.fromEntries(perms.entries());
  }
  const payload: SerializedState = {
    hq: state.hq,
    profiles: state.profiles,
    vehicles: state.vehicles,
    jobs: state.jobs,
    invitations: state.invitations,
    notifications: state.notifications,
    maintenanceRequests: state.maintenanceRequests,
    permissionOverrides: overridesObj,
    feedbackChannels: state.feedbackChannels,
  };
  await AsyncStorage.setItem(DEMO_STATE_KEY, JSON.stringify(payload));
}

async function loadFromDisk(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(DEMO_STATE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Partial<SerializedState>;
    if (!parsed || typeof parsed !== 'object') return false;
    state.hq = parsed.hq ?? null;
    state.profiles = parsed.profiles ?? [];
    state.vehicles = parsed.vehicles ?? [];
    state.jobs = parsed.jobs ?? [];
    state.invitations = parsed.invitations ?? [];
    state.notifications = parsed.notifications ?? [];
    state.maintenanceRequests = parsed.maintenanceRequests ?? [];
    state.permissionOverrides = new Map(
      Object.entries(parsed.permissionOverrides ?? {}).map(([memberId, perms]) => [
        memberId,
        new Map(Object.entries(perms)),
      ]),
    );
    state.feedbackChannels = parsed.feedbackChannels ?? { ...DEFAULT_FEEDBACK };
    return true;
  } catch {
    return false;
  }
}

// ---------- Mutable state ----------

type Hq = { lat: number; lng: number; address: string };

export type FeedbackChannels = {
  email: { enabled: boolean; address: string };
  push: { enabled: boolean };
  telegram: {
    enabled: boolean;
    /** Public handle (without @). Drives the t.me/<botUsername> link the
     * non-owner team members see in their account screen. */
    botUsername: string;
    /** Private — only owner sees this. Used server-side to send messages. */
    botToken: string;
    chatId: string;
  };
};

// Demo-only test bot — provided by the project owner so the demo flow can
// surface a real-looking Telegram setup without forcing the demo audience
// to wire up their own. The demo never actually calls the Telegram API
// (demo mode is UI-tour only); these values just pre-populate the wizard
// form so a viewer can tap "Activate bot" → "Save" without typing anything.
// The Open-in-Telegram button on the team-side card uses botUsername to
// build a t.me/<username> link, which DOES open the real bot in Telegram.
//
// **Security:** botToken intentionally a placeholder. Real test bot
// (8594702070:...) was revoked via BotFather 2026-05-13 after being
// committed to repo earlier; if you need to wire a fresh demo bot,
// generate a new one via @BotFather and replace this placeholder
// (still demo-only context — token will leak via APK decompile).
const DEMO_TELEGRAM_TEST_BOT = {
  botUsername: 'offcats_bot',
  botToken: 'DEMO_BOT_TOKEN_PLACEHOLDER',
  chatId: '1943990878',
};

const DEFAULT_FEEDBACK: FeedbackChannels = {
  email: { enabled: true, address: 'patron@demo.drivermesh' },
  push: { enabled: true },
  telegram: {
    enabled: false,
    ...DEMO_TELEGRAM_TEST_BOT,
  },
};

const state = {
  hq: null as Hq | null,
  profiles: [] as Profile[],
  vehicles: [] as Vehicle[],
  jobs: [] as Job[],
  invitations: [] as Invitation[],
  notifications: [] as Notification[],
  maintenanceRequests: [] as MaintenanceRequest[],
  // permission overrides for permissions screen — keyed by member -> permission key
  permissionOverrides: new Map<string, Map<string, boolean>>(),
  feedbackChannels: { ...DEFAULT_FEEDBACK } as FeedbackChannels,
};

function reseed() {
  state.hq = {
    lat: 41.0082,
    lng: 28.9784,
    address: 'Demo Lojistik HQ — Sultanahmet, Fatih, İstanbul',
  };

  // Demo profile avatarları — pravatar.cc CDN'inden deterministik gerçek
  // foto'lar (?img=N parametresi ID'lere stable). CachedImage offline
  // cache yapar, kullanıcı bir kere açtıktan sonra ağ olmadan da görünür.
  const AVATAR = (id: number) => `https://i.pravatar.cc/200?img=${id}`;
  state.profiles = [
    mkProfile(DEMO_OWNER_ID, 'Demo Patron', 'patron@demo.drivermesh', 'owner', 30, AVATAR(12), null, 'active'),
    mkProfile(DEMO_MANAGER_ID, 'Selin Yöneten', 'selin@demo.drivermesh', 'manager', 28, AVATAR(47), null, 'active'),
    // v7: her driver için farklı status — demo'da çeşitlilik göster
    mkProfile(DEMO_DRIVER_IDS[0], 'Ahmet Şoför', 'ahmet@demo.drivermesh', 'driver', 25, AVATAR(33), DEMO_MANAGER_ID, 'on_trip'),
    mkProfile(DEMO_DRIVER_IDS[1], 'Mehmet Yıldız', 'mehmet@demo.drivermesh', 'driver', 24, AVATAR(11), DEMO_MANAGER_ID, 'break'),
    mkProfile(DEMO_DRIVER_IDS[2], 'Ayşe Demir', 'ayse@demo.drivermesh', 'driver', 20, AVATAR(44), DEMO_MANAGER_ID, 'active'),
    mkProfile(DEMO_DRIVER_IDS[3], 'Burak Çelik', 'burak@demo.drivermesh', 'driver', 12, AVATAR(15), DEMO_MANAGER_ID, 'on_trip'),
    // (DEMO_DRIVER_IDS[4] ileride invitation olarak kullanılabilir, profile değil)
  ];

  // Demo vehicle photos uploaded to Cloudinary so the cached-image
  // pipeline has real URLs to round-trip through. The first four cars
  // get distinct photos; the fifth falls back to plate-derived gradient
  // (no photo) — keeps the empty-state branch covered too.
  const PHOTO_BASE = 'https://res.cloudinary.com/dotcw6tty/image/upload';
  const photo1 = `${PHOTO_BASE}/v1778166028/drivermesh/cars/Screenshot_2026-05-07_174307.png`;
  const photo2 = `${PHOTO_BASE}/v1778166031/drivermesh/cars/Screenshot_2026-05-07_174332.png`;
  const photo3 = `${PHOTO_BASE}/v1778166033/drivermesh/cars/Screenshot_2026-05-07_174351.png`;
  const photo4 = `${PHOTO_BASE}/v1778166035/drivermesh/cars/Screenshot_2026-05-07_174405.png`;

  // Vehicle case coverage: tum onemli durumlari demo'da gosterilebilmesi icin
  // - active + claimed + foto (3 tane, her driver'in uzerinde)
  // - maintenance + foto + sebep + bitis suresi + foto'lar (banner full data)
  // - idle + photo-less + claimable (kimsenin ustunde degil, claim'lenebilir)
  // - acik renkli (sari) — harita kontrast test'i icin
  const maintenancePhoto1 = `${PHOTO_BASE}/v1778166035/drivermesh/cars/Screenshot_2026-05-07_174405.png`;
  state.vehicles = [
    mkVehicle({
      id: 'demo-v1', plate: '34 ABC 123', brand: 'Ford', model: 'Transit',
      year: 2022, status: 'active', color: '#5B7FFF', isAtHq: false,
      photoUrl: photo1, currentUserId: DEMO_DRIVER_IDS[0], // Ahmet uzerinde
    }),
    mkVehicle({
      id: 'demo-v2', plate: '34 DEF 456', brand: 'Mercedes', model: 'Sprinter',
      year: 2023, status: 'active', color: '#FF7A1A', isAtHq: false,
      photoUrl: photo2, currentUserId: DEMO_DRIVER_IDS[1], // Mehmet uzerinde
    }),
    mkVehicle({
      id: 'demo-v3', plate: '06 GHI 789', brand: 'Volkswagen', model: 'Crafter',
      year: 2021, status: 'active', color: '#22C55E', isAtHq: false,
      photoUrl: photo3, currentUserId: DEMO_DRIVER_IDS[2], // Ayse uzerinde
    }),
    // Bakimda araç — banner full data: sebep + foto + suresi
    mkVehicle({
      id: 'demo-v4', plate: '34 JKL 234', brand: 'Iveco', model: 'Daily',
      year: 2020, status: 'maintenance', color: '#A855F7', isAtHq: true,
      photoUrl: photo4, currentUserId: null,
      maintenanceReason: 'Sol on lastik degisimi + balans ayari',
      maintenanceStartedAt: hoursAgo(3),
      maintenanceStartedBy: DEMO_MANAGER_ID,
      maintenanceUntil: hoursAgo(-2), // 2 saat sonra biter
      maintenancePhotoUrls: [maintenancePhoto1],
    }),
    // v6: idle araç ama patron üzerinde — vehicles_set_default_owner trigger'a
    // göre hiçbir araç sahipsiz kalmaz. Driver "Üzerine Al" ile alabilir.
    mkVehicle({
      id: 'demo-v5', plate: '35 MNO 567', brand: 'Renault', model: 'Master',
      year: 2024, status: 'idle', color: '#F59E0B', isAtHq: true,
      photoUrl: null, currentUserId: DEMO_OWNER_ID,
    }),
    // v5: elektrik araç + 4. driver (Burak) üzerinde — yeni feature örneği
    mkVehicle({
      id: 'demo-v6', plate: '34 PQR 890', brand: 'Renault', model: 'Trafic E-Tech',
      year: 2025, status: 'active', color: '#10B981', isAtHq: false,
      photoUrl: photo2, currentUserId: DEMO_DRIVER_IDS[3], // Burak üzerinde
    }),
    // v6: idle araç ama patron üzerinde
    mkVehicle({
      id: 'demo-v7', plate: '06 STU 123', brand: 'Peugeot', model: 'Boxer',
      year: 2023, status: 'idle', color: '#3B82F6', isAtHq: true,
      photoUrl: photo3, currentUserId: DEMO_OWNER_ID,
    }),
  ];

  // Bakim talebi history — her status icin bir kayit:
  // pending (demo-v5 icin Ahmet acti, yonetici onayi bekliyor)
  // approved (demo-v4 icin gecmis kabul edilmis talep — su anki bakim)
  // rejected (eskisinde reddedilmis bir talep)
  // cancelled (talep eden vazgecmis)
  // expired (auto-checkout sonrasi otomatik)
  state.maintenanceRequests = [
    {
      id: 'demo-mr-pending',
      organization_id: DEMO_ORG_ID,
      vehicle_id: 'demo-v5',
      requester_id: DEMO_DRIVER_IDS[0],
      reason: 'Motor uyari isigi yandi, kontrol gerekiyor',
      photo_urls: [maintenancePhoto1],
      estimated_minutes: 120,
      status: 'pending',
      decided_by: null,
      decided_at: null,
      rejection_reason: null,
      requested_at: minutesAgo(45),
      // demo: AI-generated suspect — Patron'da "AI suphesi" badge gosterir
      suspected_ai: true,
      ai_score: 0.84,
      exif_status: 'valid',
      content_class: 'vehicle',
      content_top_label: 'sports_car',
      content_score: 0.78,
      authenticity_checked_at: minutesAgo(44),
      authenticity_metadata: { demo_seed: true },
    },
    {
      id: 'demo-mr-approved',
      organization_id: DEMO_ORG_ID,
      vehicle_id: 'demo-v4',
      requester_id: DEMO_DRIVER_IDS[1],
      reason: 'Sol on lastik degisimi + balans ayari',
      photo_urls: [maintenancePhoto1],
      estimated_minutes: 300,
      status: 'approved',
      decided_by: DEMO_MANAGER_ID,
      decided_at: hoursAgo(3),
      rejection_reason: null,
      requested_at: hoursAgo(4),
      // demo: temiz authenticity — badge gosterilmez
      suspected_ai: false,
      ai_score: 0.04,
      exif_status: 'valid',
      content_class: 'vehicle',
      content_top_label: 'pickup',
      content_score: 0.91,
      authenticity_checked_at: hoursAgo(4),
      authenticity_metadata: { demo_seed: true },
    },
    {
      id: 'demo-mr-rejected',
      organization_id: DEMO_ORG_ID,
      vehicle_id: 'demo-v2',
      requester_id: DEMO_DRIVER_IDS[2],
      reason: 'Klima ariza yapmis gibi (driver kendi selfie yukledi)',
      photo_urls: [],
      estimated_minutes: null,
      status: 'rejected',
      decided_by: DEMO_OWNER_ID,
      decided_at: hoursAgo(20),
      rejection_reason: 'Klima zaten gecen ay servise gitti, yeniden kontrol gerekmiyor. Sicaklik fanı ayarini kontrol et.',
      requested_at: hoursAgo(22),
      // demo: yanlis icerik — Patron'da "Yanlis icerik" badge gosterir
      suspected_ai: false,
      ai_score: 0.02,
      exif_status: 'valid',
      content_class: 'non_vehicle',
      content_top_label: 'jersey',
      content_score: 0.67,
      authenticity_checked_at: hoursAgo(22),
      authenticity_metadata: { demo_seed: true },
    },
    {
      id: 'demo-mr-cancelled',
      organization_id: DEMO_ORG_ID,
      vehicle_id: 'demo-v1',
      requester_id: DEMO_DRIVER_IDS[0],
      reason: 'Sag farin parlakligi azaldi (foto internetten indirildi)',
      photo_urls: [],
      estimated_minutes: 60,
      status: 'cancelled',
      decided_by: null,
      decided_at: null,
      rejection_reason: null,
      requested_at: hoursAgo(48),
      // demo: EXIF eksik — Patron'da "EXIF metadata yok" badge gosterir
      suspected_ai: false,
      ai_score: 0.08,
      exif_status: 'missing',
      content_class: 'vehicle',
      content_top_label: 'minivan',
      content_score: 0.83,
      authenticity_checked_at: hoursAgo(48),
      authenticity_metadata: { demo_seed: true },
    },
    {
      id: 'demo-mr-expired',
      organization_id: DEMO_ORG_ID,
      vehicle_id: 'demo-v3',
      requester_id: DEMO_DRIVER_IDS[2],
      reason: 'Aki performans testi (planli bakim)',
      photo_urls: [maintenancePhoto1],
      estimated_minutes: 90,
      status: 'expired',
      decided_by: DEMO_OWNER_ID,
      decided_at: hoursAgo(74),
      rejection_reason: null,
      requested_at: hoursAgo(76),
      // demo: EXIF tarihi eski (30+ gun) — Patron'da "EXIF tarihi eski" badge
      // gosterir; eski bir fotoyu yeniden kullanma denemesi senaryosu.
      suspected_ai: false,
      ai_score: 0.06,
      exif_status: 'stale',
      content_class: 'vehicle',
      content_top_label: 'sedan',
      content_score: 0.88,
      authenticity_checked_at: hoursAgo(76),
      authenticity_metadata: { demo_seed: true, exif_date: '2025-12-01' },
    },
  ];

  // Jobs — full coverage of statuses so the demo audience sees every state:
  //   3 active (1 in_progress + 2 assigned), 2 completed, 1 failed, 1 cancelled.
  state.jobs = [
    mkJob('demo-j1', {
      customer: 'Mavi Mağazacılık',
      pickup: { addr: 'Levent Mahallesi, Beşiktaş', lat: 41.0816, lng: 29.0114 },
      dropoff: { addr: 'Atatürk Havalimanı Kargo, Bakırköy', lat: 40.9769, lng: 28.8146 },
      status: 'in_progress',
      driverId: DEMO_DRIVER_IDS[0],
      vehicleId: 'demo-v1',
      distanceKm: 22.4,
      etaMinutes: 38,
      source: 'internal',
      createdMinutesAgo: 95,
      assignedMinutesAgo: 88,
      startedMinutesAgo: 22,
    }),
    mkJob('demo-j2', {
      customer: 'Trendyol Hızlı Teslimat',
      pickup: { addr: 'Maltepe Depo, Maltepe', lat: 40.9351, lng: 29.1306 },
      dropoff: { addr: 'Pendik Şube, Pendik', lat: 40.8783, lng: 29.2389 },
      status: 'assigned',
      driverId: DEMO_DRIVER_IDS[1],
      vehicleId: 'demo-v2',
      distanceKm: 14.1,
      etaMinutes: 30,
      source: 'internal',
      createdMinutesAgo: 35,
      assignedMinutesAgo: 12,
    }),
    mkJob('demo-j3', {
      customer: 'Hepsiburada Lojistik',
      pickup: { addr: 'Ümraniye Dağıtım Merkezi', lat: 41.0167, lng: 29.1167 },
      dropoff: { addr: 'Kadıköy Showroom', lat: 40.9833, lng: 29.0333 },
      status: 'completed',
      driverId: DEMO_DRIVER_IDS[0],
      vehicleId: 'demo-v1',
      distanceKm: 11.8,
      etaMinutes: 25,
      source: 'internal',
      createdMinutesAgo: 320,
      assignedMinutesAgo: 315,
      startedMinutesAgo: 280,
      completedMinutesAgo: 245,
    }),
    mkJob('demo-j4', {
      customer: 'Migros Online',
      pickup: { addr: 'Esenyurt Soğuk Hava Deposu', lat: 41.0289, lng: 28.6708 },
      dropoff: { addr: 'Şişli Mağaza, Şişli', lat: 41.0602, lng: 28.9869 },
      status: 'completed',
      driverId: DEMO_DRIVER_IDS[2],
      vehicleId: 'demo-v3',
      distanceKm: 26.7,
      etaMinutes: 55,
      source: 'driver_request',
      createdMinutesAgo: 180,
      assignedMinutesAgo: 175,
      startedMinutesAgo: 160,
      completedMinutesAgo: 90,
    }),
    mkJob('demo-j5', {
      customer: 'Yemeksepeti Hızlı',
      pickup: { addr: 'Beyoğlu Restoran, Beyoğlu', lat: 41.0369, lng: 28.9850 },
      dropoff: { addr: 'Sarıyer Müşteri', lat: 41.1664, lng: 29.0571 },
      status: 'failed',
      driverId: DEMO_DRIVER_IDS[1],
      vehicleId: 'demo-v2',
      distanceKm: 19.3,
      etaMinutes: 42,
      source: 'ride',
      failReason: 'Müşteri adreste bulunamadı, telefonla ulaşılamadı.',
      createdMinutesAgo: 220,
      assignedMinutesAgo: 215,
      startedMinutesAgo: 200,
      completedMinutesAgo: 150,
    }),
    // 3rd active job — Ayşe + VW Crafter çıktı (vehicle is_at_hq=false yapıldı).
    mkJob('demo-j6', {
      customer: 'Hepsi Express',
      pickup: { addr: 'Bostancı Dağıtım, Kadıköy', lat: 40.9633, lng: 29.0905 },
      dropoff: { addr: 'Tuzla AVM, Tuzla', lat: 40.8161, lng: 29.3027 },
      status: 'assigned',
      driverId: DEMO_DRIVER_IDS[2],
      vehicleId: 'demo-v3',
      distanceKm: 31.2,
      etaMinutes: 48,
      source: 'internal',
      createdMinutesAgo: 18,
      assignedMinutesAgo: 6,
    }),
    // 1 cancelled — müşteri vazgeçti, atama yapılmadan kapatıldı.
    mkJob('demo-j7', {
      customer: 'Aksu Lojistik',
      pickup: { addr: 'Kartal Şube, Kartal', lat: 40.9036, lng: 29.1865 },
      dropoff: { addr: 'Sultanbeyli Depo', lat: 40.9605, lng: 29.2680 },
      status: 'cancelled',
      driverId: null,
      vehicleId: null,
      distanceKm: 12.4,
      etaMinutes: 26,
      source: 'internal',
      createdMinutesAgo: 130,
    }),
    // v5: Ride-source active job — Burak (demo-v6 elektrik araç) üzerinde
    // ride app'ten gelen müşteri çağrısı, in_progress
    mkJob('demo-j8', {
      customer: 'Selin Müşteri (Ride)',
      pickup: { addr: 'Galata Kulesi, Beyoğlu', lat: 41.0256, lng: 28.9742 },
      dropoff: { addr: 'Taksim Meydanı, Beyoğlu', lat: 41.0369, lng: 28.9850 },
      status: 'in_progress',
      driverId: DEMO_DRIVER_IDS[3], // Burak
      vehicleId: 'demo-v6',
      distanceKm: 2.1,
      etaMinutes: 8,
      source: 'ride',
      createdMinutesAgo: 12,
      assignedMinutesAgo: 11,
      startedMinutesAgo: 6,
    }),
    // v5: Ride-source completed — geçmiş ride, rating'li
    mkJob('demo-j9', {
      customer: 'Emre Aydın (Ride)',
      pickup: { addr: 'Kadıköy İskele, Kadıköy', lat: 40.9928, lng: 29.0269 },
      dropoff: { addr: 'Bağdat Caddesi, Suadiye', lat: 40.9614, lng: 29.0556 },
      status: 'completed',
      driverId: DEMO_DRIVER_IDS[2], // Ayşe
      vehicleId: 'demo-v3',
      distanceKm: 7.8,
      etaMinutes: 18,
      source: 'ride',
      createdMinutesAgo: 240,
      assignedMinutesAgo: 235,
      startedMinutesAgo: 225,
      completedMinutesAgo: 195,
    }),
    // v5: Driver self-request — Ahmet kendi iş açtı (yetkiyle)
    mkJob('demo-j10', {
      customer: 'Express Kurye',
      pickup: { addr: 'Mecidiyeköy, Şişli', lat: 41.0668, lng: 29.0014 },
      dropoff: { addr: 'Ataşehir Finans Merkezi', lat: 40.9923, lng: 29.1244 },
      status: 'assigned',
      driverId: DEMO_DRIVER_IDS[0], // Ahmet
      vehicleId: 'demo-v1',
      distanceKm: 17.3,
      etaMinutes: 34,
      source: 'driver_request',
      createdMinutesAgo: 25,
      assignedMinutesAgo: 22,
    }),
  ];

  // Pending invitation — bir 6. kişi davet edildi ama henüz kabul etmedi
  state.invitations = [
    {
      id: 'demo-inv1',
      organization_id: DEMO_ORG_ID,
      email: 'kerem@demo.drivermesh',
      full_name: 'Kerem Aday',
      role: 'driver',
      status: 'pending',
      invited_by: DEMO_OWNER_ID,
      manager_id: DEMO_MANAGER_ID,
      created_at: hoursAgo(6),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString(),
      token: 'D3M0AB12345678901234567890123456',
      accepted_at: null,
      accepted_by: null,
    },
  ];

  // Notifications
  state.notifications = [
    {
      id: 'demo-n1',
      organization_id: DEMO_ORG_ID,
      recipient_id: DEMO_OWNER_ID,
      actor_id: DEMO_DRIVER_IDS[0],
      type: 'driver_request',
      payload: {
        job_id: 'demo-j2',
        requester_name: 'Ahmet Şoför',
        customer_name: 'Trendyol Hızlı Teslimat',
      },
      read_at: null,
      created_at: minutesAgo(38),
    },
    {
      id: 'demo-n2',
      organization_id: DEMO_ORG_ID,
      recipient_id: DEMO_OWNER_ID,
      actor_id: DEMO_MANAGER_ID,
      type: 'permission_grant',
      payload: {
        key: 'jobs.create',
        allowed: true,
        member_id: DEMO_DRIVER_IDS[2],
        label_tr: 'İş oluşturma',
        label_en: 'Create job',
        is_critical: false,
      },
      read_at: hoursAgo(2),
      created_at: hoursAgo(3),
    },
    {
      id: 'demo-n3',
      organization_id: DEMO_ORG_ID,
      recipient_id: DEMO_OWNER_ID,
      actor_id: DEMO_DRIVER_IDS[1],
      type: 'request_approved',
      payload: {
        job_id: 'demo-j4',
        customer_name: 'Migros Online',
      },
      read_at: hoursAgo(1),
      created_at: hoursAgo(1.5),
    },
    // v7: ride_completed — doğru tip ile (önceden request_approved fake'leniyordu)
    {
      id: 'demo-n4',
      organization_id: DEMO_ORG_ID,
      recipient_id: DEMO_OWNER_ID,
      actor_id: DEMO_DRIVER_IDS[2],
      type: 'ride_completed' as never,
      payload: {
        job_id: 'demo-j9',
        ride_request_id: null,
        customer_name: 'Emre Aydın',
        stars: 5,
      },
      read_at: null,
      created_at: minutesAgo(195),
    },
    // v7: maintenance_overdue — auto-checkout cron sinyali (önceden
    // permission_grant fake'leniyordu)
    {
      id: 'demo-n5',
      organization_id: DEMO_ORG_ID,
      recipient_id: DEMO_OWNER_ID,
      actor_id: null,
      type: 'maintenance_overdue' as never,
      payload: {
        vehicle_id: 'demo-v4',
        plate: '34 JKL 234',
        reason: 'Bakım süresi doldu, araç otomatik teslim alındı',
      },
      read_at: null,
      created_at: minutesAgo(20),
    },
  ];

  state.permissionOverrides = new Map();
  state.feedbackChannels = {
    email: { ...DEFAULT_FEEDBACK.email },
    push: { ...DEFAULT_FEEDBACK.push },
    telegram: { ...DEFAULT_FEEDBACK.telegram },
  };
}

// ---------- Factories ----------

type ProfileStatus = 'active' | 'break' | 'off_duty' | 'on_trip' | 'unavailable';

function mkProfile(
  id: string,
  fullName: string,
  email: string,
  role: UserRole,
  daysAgo: number,
  avatarUrl: string | null = null,
  managerId: string | null = null,
  status: ProfileStatus = 'off_duty',
): Profile {
  return {
    id,
    organization_id: DEMO_ORG_ID,
    full_name: fullName,
    email,
    phone: null,
    role,
    avatar_url: avatarUrl,
    manager_id: managerId,
    push_token: null,
    push_platform: null,
    push_token_updated_at: null,
    created_at: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
    // status: Profile type'ında yok (DB migration sonrası types regen
    // edilmedi); runtime'da StatusPill ve filter'lar bu field'ı bekliyor.
    status,
    status_updated_at: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
  } as Profile & { status: ProfileStatus; status_updated_at: string };
}

type VehicleSpec = {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
  status: 'active' | 'maintenance' | 'idle';
  color: string;
  isAtHq: boolean;
  photoUrl?: string | null;
  currentUserId?: string | null;
  maintenanceReason?: string | null;
  maintenanceUntil?: string | null;
  maintenanceStartedAt?: string | null;
  maintenanceStartedBy?: string | null;
  maintenancePhotoUrls?: string[];
};

function mkVehicle(spec: VehicleSpec): Vehicle {
  return {
    id: spec.id,
    organization_id: DEMO_ORG_ID,
    added_by: DEMO_OWNER_ID,
    plate: spec.plate,
    brand: spec.brand,
    model: spec.model,
    year: spec.year,
    status: spec.status,
    color: spec.color,
    photo_url: spec.photoUrl ?? null,
    is_at_hq: spec.isAtHq,
    maintenance_until: spec.maintenanceUntil ?? null,
    maintenance_started_at: spec.maintenanceStartedAt ?? null,
    maintenance_started_by: spec.maintenanceStartedBy ?? null,
    maintenance_reason: spec.maintenanceReason ?? null,
    maintenance_photo_urls: spec.maintenancePhotoUrls ?? [],
    current_user_id: spec.currentUserId ?? null,
    created_at: new Date(Date.now() - 20 * 86_400_000).toISOString(),
    suspected_ai: null,
    ai_score: null,
    exif_status: null,
    content_class: null,
    content_top_label: null,
    content_score: null,
    authenticity_checked_at: null,
    authenticity_metadata: null,
  };
}

type JobSpec = {
  customer: string;
  pickup: { addr: string; lat: number; lng: number };
  dropoff: { addr: string; lat: number; lng: number };
  status: JobStatus;
  driverId: string | null;
  vehicleId: string | null;
  distanceKm: number;
  etaMinutes: number;
  source: JobSource;
  createdMinutesAgo: number;
  assignedMinutesAgo?: number;
  startedMinutesAgo?: number;
  completedMinutesAgo?: number;
  failReason?: string;
};

function mkJob(id: string, spec: JobSpec): Job {
  return {
    id,
    organization_id: DEMO_ORG_ID,
    created_by: DEMO_OWNER_ID,
    customer_name: spec.customer,
    pickup_address: spec.pickup.addr,
    pickup_lat: spec.pickup.lat,
    pickup_lng: spec.pickup.lng,
    dropoff_address: spec.dropoff.addr,
    dropoff_lat: spec.dropoff.lat,
    dropoff_lng: spec.dropoff.lng,
    distance_km: spec.distanceKm,
    eta_minutes: spec.etaMinutes,
    vehicle_id: spec.vehicleId,
    driver_id: spec.driverId,
    status: spec.status,
    source: spec.source,
    notes: null,
    fail_reason: spec.failReason ?? null,
    created_at: minutesAgo(spec.createdMinutesAgo),
    assigned_at:
      spec.assignedMinutesAgo != null ? minutesAgo(spec.assignedMinutesAgo) : null,
    started_at:
      spec.startedMinutesAgo != null ? minutesAgo(spec.startedMinutesAgo) : null,
    completed_at:
      spec.completedMinutesAgo != null ? minutesAgo(spec.completedMinutesAgo) : null,
    ride_request_id: null,
  };
}

// ---------- Read accessors (read-only snapshots) ----------

export const demo = {
  ownerProfile: () => state.profiles.find((p) => p.id === DEMO_OWNER_ID)!,
  hq: () => state.hq,
  profiles: () => [...state.profiles],
  profileById: (id: string) => state.profiles.find((p) => p.id === id) ?? null,
  vehicles: () => [...state.vehicles],
  vehicleById: (id: string) => state.vehicles.find((v) => v.id === id) ?? null,
  jobs: () => [...state.jobs].sort((a, b) => b.created_at.localeCompare(a.created_at)),
  jobById: (id: string) => state.jobs.find((j) => j.id === id) ?? null,
  invitations: () => [...state.invitations],
  notifications: () =>
    [...state.notifications].sort((a, b) => b.created_at.localeCompare(a.created_at)),
  maintenanceRequests: () =>
    [...state.maintenanceRequests].sort((a, b) =>
      b.requested_at.localeCompare(a.requested_at),
    ),
  maintenanceRequestById: (id: string) =>
    state.maintenanceRequests.find((r) => r.id === id) ?? null,
  pendingMaintenanceForVehicle: (vehicleId: string) =>
    state.maintenanceRequests.filter(
      (r) => r.vehicle_id === vehicleId && r.status === 'pending',
    ),

  // ---- mutations ----

  setHq(next: Hq) {
    state.hq = { ...next };
    emit();
  },

  addJob(job: Job) {
    state.jobs.push(job);
    emit();
  },
  updateJob(id: string, patch: Partial<Job>) {
    const i = state.jobs.findIndex((j) => j.id === id);
    if (i < 0) return;
    state.jobs[i] = { ...state.jobs[i], ...patch };
    emit();
  },

  addVehicle(v: Vehicle) {
    state.vehicles.unshift(v);
    emit();
  },
  updateVehicle(id: string, patch: Partial<Vehicle>) {
    const i = state.vehicles.findIndex((v) => v.id === id);
    if (i < 0) return;
    state.vehicles[i] = { ...state.vehicles[i], ...patch };
    emit();
  },

  updateProfile(
    id: string,
    // status field Profile tipinde yok (manuel cast'le kullanılıyor), o yüzden
    // patch'i Record olarak gevşek tutuyoruz — full_name/phone/avatar_url/status
    // hepsi geçer.
    patch: Partial<Pick<Profile, 'full_name' | 'phone' | 'avatar_url'>> & { status?: string },
  ) {
    const i = state.profiles.findIndex((p) => p.id === id);
    if (i < 0) return;
    // status field demo'da gevşek string; Profile enum'una cast — demo
    // veri tip kapsamı dışına çıkmasın diye Profile shape'i korunur.
    state.profiles[i] = { ...state.profiles[i], ...patch } as Profile;
    emit();
  },
  deleteVehicle(id: string) {
    state.vehicles = state.vehicles.filter((v) => v.id !== id);
    emit();
  },

  addInvitation(inv: Invitation) {
    state.invitations.unshift(inv);
    emit();
  },
  updateInvitation(id: string, patch: Partial<Invitation>) {
    const i = state.invitations.findIndex((x) => x.id === id);
    if (i < 0) return;
    state.invitations[i] = { ...state.invitations[i], ...patch };
    emit();
  },

  markNotificationRead(id: string) {
    const n = state.notifications.find((x) => x.id === id);
    if (!n) return;
    n.read_at = new Date().toISOString();
    emit();
  },
  addNotification(n: Notification) {
    state.notifications.unshift(n);
    emit();
  },

  // ---- maintenance requests ----

  addMaintenanceRequest(req: MaintenanceRequest) {
    state.maintenanceRequests.unshift(req);
    emit();
  },
  updateMaintenanceRequest(id: string, patch: Partial<MaintenanceRequest>) {
    const i = state.maintenanceRequests.findIndex((r) => r.id === id);
    if (i < 0) return;
    state.maintenanceRequests[i] = { ...state.maintenanceRequests[i], ...patch };
    emit();
  },

  // ---- vehicle claim / release ----
  //
  // Iki yan etki:
  //   (1) Kullanicinin uzerindeki onceki arac (varsa) -> current_user_id = null
  //   (2) Yeni arac'in eski current_user_id'si -> null (released_by_other)
  //   (3) Yeni arac.current_user_id = userId
  // Idempotent: ayni kullanici ayni araci tekrar claim ederse no-op.
  claimVehicle(vehicleId: string, userId: string, _reason: 'manual' | 'job_start' | 'transfer') {
    const target = state.vehicles.find((v) => v.id === vehicleId);
    if (!target) return;
    if (target.current_user_id === userId) return; // idempotent
    // (1) kullanicinin onceki araci varsa serbest birak
    state.vehicles = state.vehicles.map((v) =>
      v.current_user_id === userId && v.id !== vehicleId ? { ...v, current_user_id: null } : v,
    );
    // (2)+(3) target arac yeni sahibe gecsin (eski sahip varsa otomatik gider)
    state.vehicles = state.vehicles.map((v) =>
      v.id === vehicleId ? { ...v, current_user_id: userId } : v,
    );
    emit();
  },
  releaseVehicle(vehicleId: string, userId: string) {
    state.vehicles = state.vehicles.map((v) =>
      v.id === vehicleId && v.current_user_id === userId ? { ...v, current_user_id: null } : v,
    );
    emit();
  },

  // ---- feedback channels ----

  feedbackChannels(): FeedbackChannels {
    return {
      email: { ...state.feedbackChannels.email },
      push: { ...state.feedbackChannels.push },
      telegram: { ...state.feedbackChannels.telegram },
    };
  },
  setFeedbackChannels(patch: Partial<FeedbackChannels>) {
    state.feedbackChannels = {
      email: { ...state.feedbackChannels.email, ...(patch.email ?? {}) },
      push: { ...state.feedbackChannels.push, ...(patch.push ?? {}) },
      telegram: { ...state.feedbackChannels.telegram, ...(patch.telegram ?? {}) },
    };
    emit();
  },

  // ---- permissions ----

  getPermissionOverride(memberId: string, key: string): boolean | null {
    return state.permissionOverrides.get(memberId)?.get(key) ?? null;
  },
  setPermissionOverride(memberId: string, key: string, allowed: boolean | null) {
    let map = state.permissionOverrides.get(memberId);
    if (!map) {
      map = new Map();
      state.permissionOverrides.set(memberId, map);
    }
    if (allowed == null) {
      map.delete(key);
    } else {
      map.set(key, allowed);
    }
    emit();
  },
};

// ---------- Permission catalog (subset, demo-only) ----------

const PERMISSION_CATALOG = [
  // vehicles
  { key: 'vehicles.view', category: 'vehicles', label_tr: 'Araç listesini görme', label_en: 'View vehicles', is_critical: false, sort_order: 10 },
  { key: 'vehicles.create', category: 'vehicles', label_tr: 'Araç ekleme', label_en: 'Add vehicle', is_critical: false, sort_order: 11 },
  { key: 'vehicles.update', category: 'vehicles', label_tr: 'Araç güncelleme', label_en: 'Update vehicle', is_critical: false, sort_order: 12 },
  { key: 'vehicles.delete', category: 'vehicles', label_tr: 'Araç silme', label_en: 'Delete vehicle', is_critical: true, sort_order: 13 },
  // jobs
  { key: 'jobs.view', category: 'jobs', label_tr: 'İş listesi', label_en: 'View jobs', is_critical: false, sort_order: 20 },
  { key: 'jobs.create', category: 'jobs', label_tr: 'İş oluşturma', label_en: 'Create job', is_critical: false, sort_order: 21 },
  { key: 'jobs.assign', category: 'jobs', label_tr: 'İş atama', label_en: 'Assign job', is_critical: false, sort_order: 22 },
  { key: 'jobs.update_any', category: 'jobs', label_tr: 'İş güncelleme (her iş)', label_en: 'Update any job', is_critical: false, sort_order: 23 },
  { key: 'jobs.cancel', category: 'jobs', label_tr: 'İş iptali', label_en: 'Cancel job', is_critical: true, sort_order: 24 },
  // members
  { key: 'members.invite', category: 'members', label_tr: 'Ekip davet etme', label_en: 'Invite team', is_critical: false, sort_order: 30 },
  { key: 'members.remove', category: 'members', label_tr: 'Ekipten çıkarma', label_en: 'Remove member', is_critical: true, sort_order: 31 },
  // reports
  { key: 'reports.view', category: 'reports', label_tr: 'Raporları görüntüleme', label_en: 'View reports', is_critical: false, sort_order: 40 },
  // maintenance
  { key: 'vehicles.send_to_maintenance', category: 'maintenance', label_tr: 'Bakıma alma talebi', label_en: 'Send to maintenance', is_critical: false, sort_order: 50 },
  { key: 'vehicles.approve_maintenance', category: 'maintenance', label_tr: 'Bakım onaylama', label_en: 'Approve maintenance', is_critical: true, sort_order: 51 },
] as const;

const ROLE_DEFAULTS: Record<UserRole, Record<string, boolean>> = {
  owner: Object.fromEntries(PERMISSION_CATALOG.map((p) => [p.key, true])),
  manager: {
    'vehicles.view': true, 'vehicles.create': true, 'vehicles.update': true, 'vehicles.delete': false,
    'jobs.view': true, 'jobs.create': true, 'jobs.assign': true, 'jobs.update_any': true, 'jobs.cancel': false,
    'members.invite': true, 'members.remove': false,
    'reports.view': true,
    'vehicles.send_to_maintenance': true, 'vehicles.approve_maintenance': true,
  },
  driver: {
    'vehicles.view': true, 'vehicles.create': false, 'vehicles.update': false, 'vehicles.delete': false,
    'jobs.view': true, 'jobs.create': false, 'jobs.assign': false, 'jobs.update_any': false, 'jobs.cancel': false,
    'members.invite': false, 'members.remove': false,
    'reports.view': false,
    'vehicles.send_to_maintenance': true, 'vehicles.approve_maintenance': false,
  },
};

export function listDemoMemberPermissions(memberId: string): MemberPermission[] {
  const member = state.profiles.find((p) => p.id === memberId);
  if (!member) return [];
  const overrides = state.permissionOverrides.get(memberId);
  return PERMISSION_CATALOG.map((p) => {
    const defaultAllowed = ROLE_DEFAULTS[member.role][p.key] ?? false;
    const override = overrides?.get(p.key);
    const overrideAllowed = override == null ? null : override;
    const effective = overrideAllowed ?? defaultAllowed;
    return {
      key: p.key,
      category: p.category as MemberPermission['category'],
      is_critical: p.is_critical,
      label_tr: p.label_tr,
      label_en: p.label_en,
      sort_order: p.sort_order,
      default_allowed: defaultAllowed,
      override_allowed: overrideAllowed,
      effective_allowed: effective,
    };
  });
}
