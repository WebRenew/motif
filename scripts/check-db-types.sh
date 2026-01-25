#!/bin/bash
# Check if database.types.ts is in sync with the Supabase schema
# Run this after making schema changes to verify types are updated

set -e

echo "🔍 Checking database types..."

# Generate fresh types to a temp file
TEMP_FILE=$(mktemp)
npx supabase gen types typescript --project-id wrqrsmddcufdbyyhmtzo > "$TEMP_FILE" 2>/dev/null

# Compare with current types (ignoring whitespace)
if diff -q <(cat lib/types/database.types.ts | tr -d '[:space:]') <(cat "$TEMP_FILE" | tr -d '[:space:]') > /dev/null 2>&1; then
  echo "✅ Database types are in sync!"
  rm "$TEMP_FILE"
  exit 0
else
  echo "❌ Database types are out of sync!"
  echo ""
  echo "Run this to update:"
  echo "  npx supabase gen types typescript --project-id wrqrsmddcufdbyyhmtzo > lib/types/database.types.ts"
  echo ""
  rm "$TEMP_FILE"
  exit 1
fi
