# DriverMesh — Dokümantasyon Haritası

Bu workspace iki bağımsız uygulamayı barındırır:

- **fleet/** — Filo sahibi + şoför uygulaması (Expo Router)
- **ride/** — Müşteri (yolculuk talep eden) uygulaması (Expo Router)

Dokümanlar uygulamaya göre ayrılmıştır.

## fleet/

| Dosya | İçerik |
|---|---|
| [fleet/ARCHITECTURE.md](fleet/ARCHITECTURE.md) | Fleet uygulamasının mimarisi, çalışma kılavuzu, modüller arası akış |
| [fleet/AUDIT_FINDINGS.md](fleet/AUDIT_FINDINGS.md) | Güvenlik + kalite denetim bulguları |
| [fleet/CI_CD_SETUP.md](fleet/CI_CD_SETUP.md) | EAS Build + GitHub Actions pipeline kurulumu |
| [fleet/PLAY_STORE_LISTING.md](fleet/PLAY_STORE_LISTING.md) | Play Store başvuru metinleri ve assets |
| [fleet/RELEASE_CHECKLIST.md](fleet/RELEASE_CHECKLIST.md) | Production release kontrol listesi |

## ride/

| Dosya | İçerik |
|---|---|
| [ride/DRIVERMESHRIDE_DESIGN.md](ride/DRIVERMESHRIDE_DESIGN.md) | Ride app tasarım dokümanı (UI/UX, ekran akışları) |
| [ride/RIDE_DESIGN_BRIEF.md](ride/RIDE_DESIGN_BRIEF.md) | Ride app design brief — gereksinim + product spec |
| [ride/plans/2026-05-15-drivermeshride-architecture.md](ride/plans/2026-05-15-drivermeshride-architecture.md) | Ride mimari planı (20 section + 3 ek) |
| [ride/plans/2026-05-16-ride-availability-rules.md](ride/plans/2026-05-16-ride-availability-rules.md) | Araç görünürlük, şoför sahiplenme ve mesai kuralları |

## Cross-cutting (her iki uygulama)

| Dosya | İçerik |
|---|---|
| [TESTING.md](TESTING.md) | Fleet + Ride manuel/yarı-otomatik test senaryoları, doğrulama rehberi |
| [plans/2026-05-16-integration-test-plan.md](plans/2026-05-16-integration-test-plan.md) | Fleet + Ride end-to-end entegrasyon test planı |
