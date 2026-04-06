#!/usr/bin/env bash
# Rule nbr15 — Pre-commit audit: no source file over 150 lines

MAX_LINES=150
VIOLATIONS=0

for file in $(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(js|ts|jsx|tsx|mjs|cjs)$'); do
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
