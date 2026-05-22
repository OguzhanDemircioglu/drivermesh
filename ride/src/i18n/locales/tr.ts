type LocaleShape = {
  app: { name: string };
  common: Record<
    'continue' | 'cancel' | 'save' | 'send' | 'later' | 'retry' | 'confirm' | 'back' | 'close' | 'edit' | 'logout' | 'yes' | 'no',
    string
  >;
  phone: { title: string; subtitle: string; label: string; cta: string; errorInvalid: string };
  countryPicker: { title: string; searchPlaceholder: string; empty: string };
  otp: { title: string; subtitle: string; placeholder: string; cta: string; resendActive: string; resendCountdown: string; errorInvalid: string };
  profileSetup: { title: string; subtitle: string; label: string; placeholder: string; cta: string };
  tabs: { home: string; vehicles: string; account: string };
  home: { greetingMorning: string; greetingAfternoon: string; greetingEvening: string; statsTotalRides: string; statsTotalKm: string; lastTrip: string; callCta: string; pendingRating: string };
  vehicles: { title: string; cityLabel: string; callBtn: string; callPhone: string; emptyTitle: string; emptyBody: string; permissionRequired: string; permissionBody: string; permissionOpenSettings: string; refresh: string };
  account: {
    title: string;
    editProfile: string;
    language: string;
    notifications: string;
    help: string;
    legal: string;
    version: string;
    logoutConfirmTitle: string;
    logoutConfirmBody: string;
    deleteAccount: string;
    deleteAccountHint: string;
    deleteConfirmTitle: string;
    deleteConfirmBody: string;
    deleteFinalConfirmTitle: string;
    deleteFinalConfirmBody: string;
    deleteSuccessTitle: string;
    deleteSuccessBody: string;
    deleteErrorActiveRide: string;
    deleteErrorGeneric: string;
    privacyPolicy: string;
    termsOfService: string;
    notificationsEnabled: string;
    notificationsDeniedTitle: string;
    notificationsDeniedBody: string;
    openSettings: string;
  };
  call: { title: string; pickupLabel: string; pickupLoading: string; cta: string; waitingTitle: string; waitingBody: string; cancelBtn: string; timeoutTitle: string; timeoutBody: string };
  active: { statusAssigned: string; statusArrived: string; statusInProgress: string; callDriver: string; cancelTrip: string; cancelConfirmTitle: string; cancelConfirmBody: string; cancelConfirmBodyFee: string; cancelGraceCountdown: string };
  rating: { title: string; starLabel1: string; starLabel2: string; starLabel3: string; starLabel4: string; starLabel5: string; commentLabel: string; commentPlaceholder: string; cta: string; thanks: string };
  complete: { title: string; paymentReminder: string; rateDriver: string; paymentMethodCash: string; paymentMethodOther: string };
  tripDetail: { title: string; loading: string; notFound: string; pickedUpOnRoute: string };
  help: {
    title: string;
    heroTitle: string;
    heroBody: string;
    sendCta: string;
    sent: string;
    formTitle: string;
    subjectGeneral: string;
    subjectRide: string;
    subjectPayment: string;
    subjectOther: string;
    messagePlaceholder: string;
    faq: Array<{ q: string; a: string }>;
  };
  errors: Record<
    'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6' | 'T7' | 'network' | 'networkRestored' | 'unknown' | 'boundaryTitle' | 'boundaryFallback',
    string
  >;
  forceUpdate: { title: string; body: string; cta: string };
  permissions: { pushTitle: string; pushBody: string; pushAllow: string; pushDeny: string };
};

export type TranslationKeys = LocaleShape;

export const tr: LocaleShape = {
  app: {
    name: 'DriverMesh Ride',
  },
  common: {
    continue: 'Devam',
    cancel: 'İptal',
    save: 'Kaydet',
    send: 'Gönder',
    later: 'Sonra',
    retry: 'Tekrar dene',
    confirm: 'Onayla',
    back: 'Geri',
    close: 'Kapat',
    edit: 'Düzenle',
    logout: 'Çıkış yap',
    yes: 'Evet',
    no: 'Hayır',
  },
  phone: {
    title: 'Telefon numaran',
    subtitle: 'Sana 6 haneli bir doğrulama kodu göndereceğiz.',
    label: 'Cep telefonu',
    cta: 'Giriş Yap',
    errorInvalid: 'Geçerli bir cep telefonu numarası gir.',
  },
  countryPicker: {
    title: 'Ülke seç',
    searchPlaceholder: 'Ülke ara (örn. Türkiye, +90, TR)',
    empty: 'Eşleşen ülke bulunamadı.',
  },
  otp: {
    title: 'Doğrulama kodu',
    subtitle: '{{phone}} numarasına gönderilen 6 haneli kodu gir.',
    placeholder: '000000',
    cta: 'Doğrula',
    resendActive: 'Kodu yeniden gönder',
    resendCountdown: '{{seconds}} sn sonra tekrar gönderebilirsin',
    errorInvalid: 'Kod hatalı veya süresi dolmuş.',
  },
  profileSetup: {
    title: 'Seni nasıl tanıyalım?',
    subtitle: 'Şoför sana ulaşırken bu adı görecek.',
    label: 'Ad soyad',
    placeholder: 'Örn. Ayşe Yılmaz',
    cta: 'Devam et',
  },
  tabs: {
    home: 'Anasayfa',
    vehicles: 'Araçlar',
    account: 'Hesap',
  },
  home: {
    greetingMorning: 'Günaydın',
    greetingAfternoon: 'İyi günler',
    greetingEvening: 'İyi akşamlar',
    statsTotalRides: 'Toplam yolculuk',
    statsTotalKm: 'Toplam km',
    lastTrip: 'Son yolculuğun',
    callCta: 'Araç çağır',
    pendingRating: 'Son yolculuğunu değerlendir',
  },
  vehicles: {
    title: 'Araçlar',
    cityLabel: 'Şehir',
    callBtn: 'Çağır',
    callPhone: 'Ara',
    emptyTitle: 'Bu şehirde müsait araç yok',
    emptyBody: 'Başka bir şehir seçebilir veya birazdan tekrar bakabilirsin.',
    permissionRequired: 'Konum izni gerekli',
    permissionBody: 'Şoförün sana ulaşabilmesi için konum iznine ihtiyacımız var.',
    permissionOpenSettings: 'Ayarları aç',
    refresh: 'Listeyi yenile',
  },
  account: {
    title: 'Hesabım',
    editProfile: 'Profili düzenle',
    language: 'Dil',
    notifications: 'Bildirimler',
    help: 'Yardım',
    legal: 'Yasal',
    version: 'Sürüm',
    logoutConfirmTitle: 'Çıkış yap',
    logoutConfirmBody: 'Oturumunu kapatmak istediğine emin misin?',
    deleteAccount: 'Hesabımı sil',
    deleteAccountHint: '30 gün içinde geri dönebilirsin',
    deleteConfirmTitle: 'Hesabını silmek üzeresin',
    deleteConfirmBody: 'Profilin ve geçmiş yolculukların 30 gün içinde geri alınabilir kalır. 30 gün sonra kalıcı olarak silinir.',
    deleteFinalConfirmTitle: 'Emin misin?',
    deleteFinalConfirmBody: 'Bu işlemi onayladığında çıkış yapılacak ve hesabın 30 günlük geri-dönüş bekleme süresine girer.',
    deleteSuccessTitle: 'Hesabın silinmek üzere',
    deleteSuccessBody: 'Kaydın 30 gün içinde geri alınabilir. Bu süre sonunda kalıcı silinir.',
    deleteErrorActiveRide: 'Önce mevcut yolculuğunu tamamla veya iptal et.',
    deleteErrorGeneric: 'Hesap silme sırasında bir sorun oldu. Tekrar dene.',
    privacyPolicy: 'Gizlilik Politikası',
    termsOfService: 'Kullanım Koşulları',
    notificationsEnabled: 'Bildirimler açık',
    notificationsDeniedTitle: 'Bildirimler kapalı',
    notificationsDeniedBody: 'Sistem ayarlarından açabilirsin.',
    openSettings: 'Ayarları aç',
  },
  call: {
    title: 'Bu aracı çağır',
    pickupLabel: 'Buluşma noktası',
    pickupLoading: 'Konumun bulunuyor…',
    cta: 'Çağır',
    waitingTitle: 'Şoför bilgilendirildi',
    waitingBody: 'Kabul bekleniyor…',
    cancelBtn: 'İptal',
    timeoutTitle: 'Şu an müsait değil',
    timeoutBody: 'Şoför yanıt vermedi. Başka bir araç dene.',
  },
  active: {
    statusAssigned: 'Şoför yolda',
    statusArrived: 'Şoför geldi!',
    statusInProgress: 'Yoldayız',
    callDriver: 'Ara',
    cancelTrip: 'İptal',
    cancelConfirmTitle: 'Yolculuğu iptal et',
    cancelConfirmBody: 'Yolculuğu iptal etmek istiyor musun? İlk 2 dakika içinde ücretsiz.',
    cancelConfirmBodyFee: 'Şoför zaten yola çıktı. Şimdi iptal edersen iptal ücreti uygulanabilir. Yine de iptal et?',
    cancelGraceCountdown: 'Ücretsiz iptal: {{time}} kaldı',
  },
  rating: {
    title: 'Yolculuğu değerlendir',
    starLabel1: 'Hiç beğenmedim',
    starLabel2: 'Beğenmedim',
    starLabel3: 'Fena değil',
    starLabel4: 'Beğendim',
    starLabel5: 'Mükemmel',
    commentLabel: 'Yorumun (opsiyonel)',
    commentPlaceholder: 'Şoförle yolculuğun nasıldı?',
    cta: 'Gönder',
    thanks: 'Teşekkürler 🙏',
  },
  complete: {
    title: 'Yolculuğun tamamlandı',
    paymentReminder: 'Kapıda nakit ödemeyi unutma',
    rateDriver: 'Şoförü değerlendir',
    paymentMethodCash: 'Kapıda nakit',
    paymentMethodOther: 'Diğer',
  },
  tripDetail: {
    title: 'Yolculuk Detayı',
    loading: 'Yükleniyor…',
    notFound: 'Yolculuk bulunamadı',
    pickedUpOnRoute: 'Şoför yolda alındı',
  },
  help: {
    title: 'Yardım',
    heroTitle: 'Nasıl yardım edebiliriz?',
    heroBody: 'Sorularına 24 saat içinde dönüş yaparız.',
    sendCta: 'Gönder',
    sent: 'Mesajın iletildi 📩',
    formTitle: 'Mesaj gönder',
    subjectGeneral: 'Genel',
    subjectRide: 'Yolculuk',
    subjectPayment: 'Ödeme',
    subjectOther: 'Diğer',
    messagePlaceholder: 'Sorununu yaz...',
    faq: [
      { q: 'Şoförüm gelmedi, ne yapmalıyım?', a: 'Yolculuğunu iptal edip yakındaki başka bir aracı çağırabilirsin. Şoför iletişim için aktif yolculuk sırasında "Ara" butonunu kullan.' },
      { q: 'Ücret yanlış mı?', a: 'Tahmini ücret mesafe ve süreye göre hesaplanır. Kapıda nakit ödüyorsan şoförle anlaşma kesindir. İtirazını destek formundan iletebilirsin.' },
      { q: 'Eşyamı arabada unuttum', a: 'Aktif yolculuğun ekranındaki "Ara" butonu ile şoföre direkt ulaş. Yolculuk geçmişinden de detaya ulaşabilirsin.' },
      { q: 'Hesabımı silmek istiyorum', a: 'Hesap → Hesabımı sil ile başlatabilirsin. 30 gün içinde geri dönülebilir, sonra kalıcı silinir.' },
      { q: 'Telefon numaramı değiştirmek istiyorum', a: 'Şu anda telefon numarası değiştirme self-service mevcut değil. Destek formuyla bize ulaş.' },
    ],
  },
  errors: {
    T1: 'Geçerli bir telefon numarası gir.',
    T2: 'Çok fazla deneme yaptın. Birazdan tekrar dene.',
    T3: 'Bu araç şu an müsait değil.',
    T4: 'Hesabın şu an aktif değil. Destek ile iletişime geç.',
    T5: 'Konum izni gerekli.',
    T6: 'Bu filo şu an ride entegrasyonu kapalı.',
    T7: 'Zaten aktif bir yolculuğun var.',
    network: 'İnternet bağlantın yok.',
    networkRestored: 'Bağlantı kuruldu',
    unknown: 'Bir şeyler ters gitti. Tekrar dene.',
    boundaryTitle: 'Bir şeyler ters gitti',
    boundaryFallback: 'Beklenmeyen bir hata oluştu.',
  },
  forceUpdate: {
    title: 'Yeni sürüm gerekli',
    body: 'Bu sürümü artık desteklemiyoruz. Devam etmek için güncelle.',
    cta: 'Mağazadan güncelle',
  },
  permissions: {
    pushTitle: 'Bildirimlere izin ver',
    pushBody: 'Şoförün yola çıktığında ve geldiğinde haberin olsun.',
    pushAllow: 'İzin ver',
    pushDeny: 'Şimdi değil',
  },
};
