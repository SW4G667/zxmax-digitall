#!/usr/bin/env bash
set -euo pipefail

# Exit 0 = Vercel skips the build. Exit 1 = build normally.
# Backend/docs-only changes are deployed elsewhere and should not burn a Vercel build.
if ! git rev-parse HEAD^ >/dev/null 2>&1; then
  exit 1
fi

needs_build=0
while IFS= read -r file; do
  [ -z "$file" ] && continue
  case "$file" in
    docs/*|.github/*|auth-email-templates/*|supabase/*|*.md)
      ;;
    *)
      needs_build=1
      break
      ;;
  esac
done < <(git diff --name-only HEAD^ HEAD)

if [ "$needs_build" -eq 0 ]; then
  echo "ZXMAX: somente backend/docs/CI mudaram; pulando build da Vercel."
  exit 0
fi

echo "ZXMAX: frontend/configuração web mudou; executando build."
exit 1
