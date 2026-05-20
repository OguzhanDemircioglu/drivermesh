-- filoLocal şemasını PostgREST API'de expose et.
-- Resmi yöntem: authenticator role config + gerekli grant'lar.
-- Ref: https://supabase.com/docs/guides/api/using-custom-schemas
alter role authenticator set pgrst.db_schemas = 'public, filoLocal';

grant usage on schema "filoLocal" to anon, authenticated, service_role;
grant all on all tables in schema "filoLocal" to anon, authenticated, service_role;
grant all on all routines in schema "filoLocal" to anon, authenticated, service_role;
grant all on all sequences in schema "filoLocal" to anon, authenticated, service_role;

alter default privileges for role postgres in schema "filoLocal" grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema "filoLocal" grant all on routines to anon, authenticated, service_role;
alter default privileges for role postgres in schema "filoLocal" grant all on sequences to anon, authenticated, service_role;

-- PostgREST'in yeni config'i okuması için reload
notify pgrst, 'reload config';;
