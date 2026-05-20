# Supabase Migrations

Bu dizin DriverMesh production şemasının versiyonlu migration history'sini tutar. Pattern: Flyway/Liquibase tarzı; her dosya `YYYYMMDDHHMMSS_<isim>.sql` formatında, sıralı uygulanır.

## Mevcut durum (2026-05-20)

- **94 migration** (93 prod baseline + 1 Hierarchy Phase 2 RLS)
- Production: `ucitxvsndlwvvnqwabgo` (eu-central-1), Postgres 17.6
- Baseline `scripts/dump_migrations.py` ile `supabase_migrations.schema_migrations` tablosundan çekildi (2026-05-20)

## Yeni migration nasıl eklenir

```powershell
# 1. Yeni boş dosya yarat (timestamp otomatik)
npx supabase migration new <kisa_isim>
# -> supabase/migrations/20260521134522_kisa_isim.sql

# 2. SQL'i düzenle (DDL: CREATE/ALTER/DROP, RLS policy, RPC vb.)

# 3. Lokalde test et (Docker stack)
npx supabase db reset       # baseline + bu migration uygulanır temiz DB'de

# 4. Uzak (prod) DB'ye uygula
npx supabase db push
```

Manuel dashboard SQL editor'den çalıştırıldıysa (acil durum), sonradan
`scripts/register_migration.py <version> <name> <path>` ile schema_migrations
tablosuna kaydet — yoksa CLI "missing on remote" der.

## Local Postgres

```powershell
# Docker stack (Postgres + Auth + Storage + Realtime)
npx supabase start

# Schema baseline + tüm migration'lar uygulanır
npx supabase db reset

# Bağlantı
psql postgresql://postgres:postgres@localhost:54322/postgres
```

`.env` için lokal Postgres password (varsayılan): `postgres`. Kullanıcı kendi
local instance'ı için `LOCAL_DB_PASSWORD` belirleyebilir (fleet/.env, ride/.env).

## Başka DB'ye taşıma

Migration'lar Supabase-spesifik bazı parçalar içerir:
- `auth.uid()`, `auth.users` join → vanilla Postgres'te ekvivalent yok, JWT middleware ile map gerekir
- RLS policy'ler → pure Postgres, taşınır
- `storage.objects`, edge functions, realtime → DB dışı, ayrı servis

Vanilla Postgres'e taşırken `auth.*` referansları temizlenmeli + uygulama katmanı
JWT verification yapmalı. Migration dosyaları aynen kullanılabilir (sadece
`auth.*` parçalar replace edilmeli).

## Kritik notlar

- **DDL'ler yalnızca migration dosyası olarak gelir** — `mcp__supabase__apply_migration` veya Dashboard SQL Editor doğrudan kullanılmaz (aksi halde schema_migrations sync bozulur)
- **Eski filoLocal schema** — repo'da `filoLocal` adında bir schema var (eski v1). Aktif public schema kullanılıyor, ama RLS hâlâ orada. Cleanup ayrı kalem
- **schema_migrations sync** — sorun yaşarsan: `npx supabase migration list --linked` ile local↔remote diff göster
