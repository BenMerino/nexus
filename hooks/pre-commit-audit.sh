#!/usr/bin/env bash
# Rule nbr15 — Pre-commit audit: no source file over 150 lines

MAX_LINES=150
VIOLATIONS=0

# Vendored from Zincro — carbon-copied as-is, do not refactor here.
# Pulled in by the graph-engine migration; size rule does not apply.
for file in $(git diff --cached --name-only --diff-filter=ACM \
    | grep -E '\.(js|ts|jsx|tsx|mjs|cjs)$' \
    | grep -v '\-bundle\.js$' \
    | grep -v '^apps/web/ui/' \
    | grep -v '^apps/web/architect/' \
    | grep -v '^apps/web/calendar/' \
    | grep -v '^apps/web/hooks/' \
    | grep -v '^apps/web/telemetry/'); do
  lines=$(wc -l < "$file")
  if [ "$lines" -gt "$MAX_LINES" ]; then
    echo "RULE nbr15 VIOLATION: $file has $lines lines (max $MAX_LINES)"
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
done

if [ "$VIOLATIONS" -gt 0 ]; then
  echo ""
  echo "$VIOLATIONS file(s) exceed $MAX_LINES lines. Refactor before committing."
  exit 1
fi

exit 0
