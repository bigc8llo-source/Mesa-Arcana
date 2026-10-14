#!/usr/bin/env bash
# Valida as migrations e as regras de RLS num Postgres da imagem supabase/postgres.
# Uso: docker run -d --name mesa-pg -e POSTGRES_PASSWORD=postgres -p 55432:5432 supabase/postgres:17.11.0.004
#      npm run test:db
set -euo pipefail
export PGPASSWORD="${PGPASSWORD:-postgres}"
PSQL="psql -h ${PGHOST:-localhost} -p ${PGPORT:-55432} -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q"
$PSQL -c "drop schema if exists public cascade; create schema public; grant usage on schema public to anon, authenticated, service_role; grant all on schema public to postgres;" \
      -c "drop table if exists realtime.messages, realtime.sent; drop table if exists storage.objects, storage.buckets;"
$PSQL -f supabase/tests/stubs.sql
for f in supabase/migrations/*.sql; do $PSQL -f "$f"; done
$PSQL -f supabase/tests/rls_test.sql 2>&1 | grep -E 'ok -|FALHOU|ERROR' 
