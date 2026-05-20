# scripts/

Operasyonel one-shot Python script'leri. Her birinin docstring'inde kullanım açıklaması var.

## Gereksinim

```powershell
python -m pip install --user psycopg2-binary
```

Tüm script'ler `SUPABASE_DB_PASSWORD` env'ini bekler:

```powershell
$env:DB_PASS = (Select-String -Path fleet/.env -Pattern '^SUPABASE_DB_PASSWORD=' | ForEach-Object { ($_ -split '=',2)[1] })
```

veya Bash:

```bash
export DB_PASS=$(grep '^SUPABASE_DB_PASSWORD=' fleet/.env | cut -d= -f2-)
```

## Script'ler

### `dump_migrations.py`

`supabase_migrations.schema_migrations` tablosundaki tüm migration'ları
`supabase/migrations/<version>_<name>.sql` formatında dosya olarak yazar.

```bash
python scripts/dump_migrations.py
```

Bir kerelik baseline oluşturmak için kullanılır. Bundan sonra yeni migration'lar
`npx supabase migration new` ile oluşturulup repo'ya commit edilir.

### `register_migration.py`

Dashboard SQL Editor'dan manuel çalıştırılan bir migration'ı sonradan
`supabase_migrations.schema_migrations` tablosuna kaydeder — CLI'nin
"missing on remote" demesini engeller.

```bash
python scripts/register_migration.py <version> <name> <sql_file_path>
```

Örnek:

```bash
python scripts/register_migration.py 20260520120000 \
    hierarchy_phase2_manager_scope_rls \
    supabase/migrations/20260520120000_hierarchy_phase2_manager_scope_rls.sql
```
