#!/usr/bin/env bash
# Nexus arch-audit — enforces invariants N1–N5 on STAGED files at commit time.
# Canon: .claude/rules/hard-rules.md. Run standalone: `bash scripts/arch-audit.sh`.
#
# Hard (block commit): N2 dead-tree edits, N4 data-layer leaks, N5 file size.
# Soft (warn only):     N1 handler gate (baseline clean — promote to hard if it stays clean),
#                       N3 token bypass (DNA migration still in progress).
# Per-file opt-out: add a comment `arch-audit-ignore: N1` (or N2/N3/N4/N5) to the file.

set -uo pipefail
HARD=0
SOFT=0

staged() { git diff --cached --name-only --diff-filter=ACM; }
optout()  { grep -qE "arch-audit-ignore:[[:space:]]*$1" "$2" 2>/dev/null; }

# ── N2 — no edits to the dead pre-monorepo root trees ──────────────────────
while IFS= read -r f; do
  [ -z "$f" ] && continue
  echo "N2 BLOCK  $f — root api/lib/public/legacy is dead; edit apps/api or apps/web."
  HARD=$((HARD+1))
done < <(staged | grep -E '^(api|lib|public|legacy)/' || true)

# ── N4 — data-layer isolation ──────────────────────────────────────────────
# N4a: real @vercel/postgres import anywhere under apps/ (use lib/sql.js).
while IFS= read -r f; do
  [ -z "$f" ] && continue; [ -f "$f" ] || continue
  optout N4 "$f" && continue
  if grep -qE "(require\(|from )['\"]@vercel/postgres" "$f"; then
    echo "N4 BLOCK  $f — import the local lib/sql.js wrapper, not @vercel/postgres."
    HARD=$((HARD+1))
  fi
done < <(staged | grep -E '^apps/' || true)
# N4b: a DB driver in frontend code (browser must reach data via fetch('/api')).
while IFS= read -r f; do
  [ -z "$f" ] && continue; [ -f "$f" ] || continue
  optout N4 "$f" && continue
  if grep -qE "require\(['\"]pg['\"]\)|from ['\"]pg['\"]|new Pool\(|@vercel/postgres" "$f"; then
    echo "N4 BLOCK  $f — frontend must not touch the DB; fetch('/api/...') instead."
    HARD=$((HARD+1))
  fi
done < <(staged | grep -E '^apps/web/public/.*\.(ts|tsx|js)$' || true)

# ── N5 — file size (nbr15): one concern per file, refactor don't compress ──
while IFS= read -r f; do
  [ -z "$f" ] && continue; [ -f "$f" ] || continue
  optout N5 "$f" && continue
  lines=$(wc -l < "$f")
  if [ "$lines" -gt 150 ]; then
    echo "N5 BLOCK  $f has $lines lines (max 150) — extract a cohesive chunk, don't compress."
    HARD=$((HARD+1))
  fi
done < <(staged | grep -E '\.(js|ts|jsx|tsx|mjs|cjs)$' \
                | grep -v -- '-bundle\.js$' \
                | grep -vE '^apps/web/(ui|architect|calendar|hooks|telemetry)/' || true)

# ── N1 (soft) — a data-reading handler with no scope/role gate ─────────────
while IFS= read -r f; do
  [ -z "$f" ] && continue; [ -f "$f" ] || continue
  optout N1 "$f" && continue
  grep -qE "sql\`|require\(['\"][^'\"]*lib/(db|sql)" "$f" || continue
  grep -qE "requireScope|requireRole|requireEditor|getScope|getUser" "$f" && continue
  echo "N1 WARN   $f — data-reading handler with no requireScope/requireEditor gate."
  SOFT=$((SOFT+1))
done < <(staged | grep -E '^apps/api/handlers/.*\.js$' \
                | grep -v '^apps/api/handlers/public/' \
                | grep -v 'asset-shim\.js$' || true)

# ── N3 (soft) — newly-added hardcoded hex / --chart-N in web code ───────────
while IFS= read -r f; do
  [ -z "$f" ] && continue; [ -f "$f" ] || continue
  optout N3 "$f" && continue
  added=$(git diff --cached -U0 -- "$f" | grep -E '^\+[^+]' || true)
  if echo "$added" | grep -qE '#[0-9a-fA-F]{6}\b|--chart-[0-9]'; then
    echo "N3 WARN   $f — hardcoded hex or --chart-N; use semantic tokens (--primary, --journal…)."
    SOFT=$((SOFT+1))
  fi
done < <(staged | grep -E '^apps/web/.*\.(ts|tsx|js|css)$' \
                | grep -vE '(shared|dna)\.css$' \
                | grep -vE '(theme-config|tokens)\.ts$' || true)

[ "$SOFT" -gt 0 ] && echo "" && echo "$SOFT soft warning(s) (N1/N3) — not blocking."
if [ "$HARD" -gt 0 ]; then
  echo ""
  echo "$HARD hard violation(s). Fix them, or add 'arch-audit-ignore: <Nx>' if it's a sanctioned exception."
  exit 1
fi
exit 0
