#!/bin/sh

set -eu

copy_if_missing() {
  source_file="$1"
  target_file="$2"

  if [ -f "$target_file" ]; then
    echo "Skipping $target_file (already exists)"
    return
  fi

  cp "$source_file" "$target_file"
  echo "Created $target_file from $source_file"
}

copy_if_missing "backend/.env.example" "backend/.env"
copy_if_missing "frontend/.env.example" "frontend/.env"
copy_if_missing "driver-assignment-service/.env.example" "driver-assignment-service/.env"

echo "Environment files are ready. Review the new .env files before starting the app."
