#!/usr/bin/env bash
# Runs the SQL behaviour tests against a throw-away local Postgres (PG 15+), using a minimal stub of Supabase's
# auth/storage schemas. It applies every migration in supabase/migrations, seeds data, then runs each test file on a
# fresh copy of that database so tests cannot affect one another.
#
#   PGUSER=postgres PGHOST=localhost ./supabase/tests/run.sh
#
# Each test file prints "OK ..." lines and aborts with "ASSERT FAILED: ..." on the first failure.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
mig="$here/../migrations"
tmpl="vtc_test_template"
errfile="$(mktemp)"
trap 'rm -f "$errfile"' EXIT
psql_q() { psql -q -v ON_ERROR_STOP=1 "$@"; }

psql -q -d postgres -c "drop database if exists $tmpl" -c "create database $tmpl" >/dev/null 2>&1
psql_q -d "$tmpl" -f "$here/supabase_stub.sql" -f "$here/supabase_stub_defaults.sql" 2>&1 | grep -v -E "WARNING|HINT" || true
for f in $(ls "$mig"/*.sql | sort); do
  if ! psql_q -d "$tmpl" --single-transaction -f "$f" >/dev/null 2>"$errfile"; then
    case "$(basename "$f")" in
      # Pre-existing: this migration alters public.payment_clearances, which no migration creates
      # (it must have been created outside the migration history). Skipped here, as it would fail on a clean database.
      20260201043931_*) echo "note: skipping known-broken migration $(basename "$f")" ;;
      *) echo "MIGRATION FAILED: $(basename "$f")"; cat "$errfile"; exit 1 ;;
    esac
  fi
done
psql_q -d "$tmpl" -f "$here/00_seed.sql" >/dev/null

status=0
for t in "$here"/[0-9][0-9]_*.sql; do
  [[ "$t" == *00_seed.sql ]] && continue
  db="vtc_test_run"
  psql -q -d postgres -c "drop database if exists $db" -c "create database $db template $tmpl" >/dev/null 2>&1
  echo "== $(basename "$t")"
  rc=0
  out=$(psql -q -tA -v ON_ERROR_STOP=1 -d "$db" -f "$t" 2>&1) || rc=$?
  echo "$out" | grep -E -i "^OK|error|ASSERT|DETAIL" || true
  [ "$rc" -eq 0 ] || status=1
done
psql -q -d postgres -c "drop database if exists vtc_test_run" -c "drop database if exists $tmpl" >/dev/null 2>&1
exit $status
