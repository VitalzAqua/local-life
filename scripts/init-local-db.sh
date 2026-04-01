#!/bin/sh

set -eu

SEED_STORES=0

if [ "${1:-}" = "--with-stores" ]; then
  SEED_STORES=1
fi

PGUSER="${PGUSER:-${USER:-postgres}}"
PGDATABASE="${PGDATABASE:-local_life}"

echo "Applying schema to database '$PGDATABASE' as user '$PGUSER'..."
psql -v ON_ERROR_STOP=1 -U "$PGUSER" -d "$PGDATABASE" -f backend/sql/schema.sql

if [ "$SEED_STORES" -eq 1 ]; then
  echo "Seeding store data into '$PGDATABASE'..."
  psql -v ON_ERROR_STOP=1 -U "$PGUSER" -d "$PGDATABASE" -f backend/sql/1000_stores.sql
fi

echo "Database setup complete."
