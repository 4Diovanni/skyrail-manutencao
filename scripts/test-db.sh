#!/usr/bin/env bash
# Aplica as migrações num banco descartável e roda os testes de RLS.
# Uso: PGHOST=... PGPORT=... PGUSER=postgres npm run test:db
set -euo pipefail
DB=skyrail_test_$$
psql -q -c "create database $DB"
trap 'psql -q -c "drop database if exists $DB" >/dev/null' EXIT
psql -q -d "$DB" -f supabase/tests/stubs.sql 2>&1 | grep -v "already exists" || true
for f in supabase/migrations/*.sql; do psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f"; done
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/rls_relatorio.sql
