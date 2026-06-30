#!/usr/bin/env bash
# Nexus arch-audit — enforces invariants N1–N5 on STAGED files at commit time.
# Canon: .claude/rules/hard-rules.md. Run standalone: `bash scripts/arch-audit.sh`.
#
# Hard (block commit): N2 dead-tree edits, N4 data-layer leaks, N5 file size,
#                       N3-type (hardcoded font-size/weight/family) + N3-gen (type
#                       artifacts drifted from ui/dna/type-scale.js) + N3-radius
#                       (hardcoded border-radius px — use --radius-*/--_nest-corner).
# Soft (warn only):     N1 handler gate (baseline clean — promote to hard if it stays clean),
#                       N3 hex/--chart-N bypass (color DNA migration still in progress).
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

# ── N3-type (hard) — no hardcoded typography outside the token system ───────
#  Type is GENERATED from ui/dna/type-scale.js into dna.css + tokens.ts (one
#  source, no loose horses). A newly-added raw font-size/weight/family literal
#  in web code (incl. inline <style> in .html) bypasses it. Build type from
#  tokens (var(--text-*), var(--weight-*), var(--font-*)) or <BaseText variant=…>.
#  Exempt: the primitives layer (it IS the resolution layer), the generated
#  source/artifacts, the raw family stacks in shared.css, and ui/graph-engine/
#  (vendored from Zincro + SVG <text> numeric fontSize that can't take CSS vars;
#  chart-tick type is Zincro-owned debt, fixed upstream then synced).
#  Per-file: arch-audit-ignore: N3.
while IFS= read -r f; do
  [ -z "$f" ] && continue; [ -f "$f" ] || continue
  optout N3 "$f" && continue
  added=$(git diff --cached -U0 -- "$f" | grep -E '^\+[^+]' || true)
  # font-size/letter-spacing with a literal px/rem/em (not inside var()), OR a
  # numeric font-weight, OR a raw font-family naming a font stack.
  hits=$(echo "$added" \
    | grep -viE 'var\(--' \
    | grep -iE "(font-size|letter-spacing)[[:space:]]*:[[:space:]]*-?[0-9.]+(px|rem|em)|fontSize[[:space:]]*:[[:space:]]*['\"]?-?[0-9.]+(px|rem|em)|font-weight[[:space:]]*:[[:space:]]*[1-9]00|fontWeight[[:space:]]*:[[:space:]]*[1-9]00|font-family[[:space:]]*:[[:space:]]*['\"]?(Inter|Instrument|JetBrains|monospace|sans-serif|serif)" \
    || true)
  if [ -n "$hits" ]; then
    echo "N3 BLOCK  $f — hardcoded typography (font-size/weight/family). Edit ui/dna/type-scale.js + npm run gen:type, use var(--text-*/--weight-*/--font-*), or <BaseText variant=…>."
    HARD=$((HARD+1))
  fi
done < <(staged | grep -E '^apps/web/.*\.(ts|tsx|js|css|html)$' \
                | grep -vE '^apps/web/ui/primitives/' \
                | grep -vE '^apps/web/ui/graph-engine/' \
                | grep -vE '(type-scale\.js|gen-type-scale\.mjs)$' \
                | grep -vE '^apps/web/public/(shared|dna-defaults)\.css$' || true)

# ── N3-radius (hard) — corners come from the radius tokens / concentric mech ──
#  Every corner is system-controlled: a --radius-* token, or --_nest-corner (the
#  concentric mechanism, curving parallel to its host). A newly-added literal
#  `border-radius: Npx` bypasses it. Use var(--radius-* | --_nest-corner). Exempt
#  shapes (999px pill, 50% circle, 0), var() values, the primitives + vendored
#  graph-engine layers, and the token source files. Per-file: arch-audit-ignore: N3.
while IFS= read -r f; do
  [ -z "$f" ] && continue; [ -f "$f" ] || continue
  optout N3 "$f" && continue
  added=$(git diff --cached -U0 -- "$f" | grep -E '^\+[^+]' || true)
  # border-radius / borderRadius with a literal px/rem/em, not var(), not a
  # full-pill (999px) / circle (50%) / 0.
  hits=$(echo "$added" \
    | grep -ivE 'var\(--|999px|50%|:[[:space:]]*0(px)?[;\"]' \
    | grep -iE "border-?[Rr]adius[[:space:]]*:[[:space:]]*['\"]?[0-9.]+(px|rem|em)" \
    || true)
  if [ -n "$hits" ]; then
    echo "N3 BLOCK  $f — hardcoded border-radius; use var(--radius-* ) or var(--_nest-corner) (concentric)."
    HARD=$((HARD+1))
  fi
done < <(staged | grep -E '^apps/web/.*\.(ts|tsx|js|css|html)$' \
                | grep -vE '^apps/web/ui/primitives/' \
                | grep -vE '^apps/web/ui/graph-engine/' \
                | grep -vE '^apps/web/public/(shared|dna-defaults)\.css$' || true)

# ── N3-gen (hard) — generated type artifacts must match their source ────────
#  If type-scale.js, dna.css, or tokens.ts is staged, the generated blocks must
#  be in sync (no hand-edit between the @generated/@end sentinels).
if staged | grep -qE '^apps/web/(ui/dna/type-scale\.js|public/dna\.css|ui/primitives/tokens\.ts)$'; then
  if ! ( cd apps/web && node scripts/gen-type-scale.mjs --check >/dev/null 2>&1 ); then
    echo "N3 BLOCK  type artifacts drifted from ui/dna/type-scale.js — run 'npm run gen:type' (web) and stage the result."
    HARD=$((HARD+1))
  fi
fi

# ── N8 — Analytics foundation (catalog-as-source / sparse atoms) ───────────
# N8a: client-side chart data-shaping. A GraphDirective literal with a chart
#  `type:` in public web code means the browser is shaping chart data — it must
#  be a server-COMPOSED catalog kind rendered via <RecomposeChart>. Opt-out
#  (arch-audit-ignore: N8) sanctions the documented year-fallback seed.
while IFS= read -r f; do
  [ -z "$f" ] && continue; [ -f "$f" ] || continue
  optout N8 "$f" && continue
  added=$(git diff --cached -U0 -- "$f" | grep -E '^\+[^+]' || true)
  if echo "$added" | grep -qE "type:[[:space:]]*['\"](bar|donut|line|stacked-bar|heatmap|area|pie)['\"]"; then
    echo "N8 BLOCK  $f — chart directive shaped client-side; make it an AnalyticsCatalog compose kind + <RecomposeChart>."
    HARD=$((HARD+1))
  fi
done < <(staged | grep -E '^apps/web/public/.*\.(ts|tsx)$' || true)

# N8b: a chart kind registered OUTSIDE the catalog. A hand-maintained
#  kind→composer map reintroduces the monolith the generated registry replaced.
#  The catalog files themselves are exempt.
while IFS= read -r f; do
  [ -z "$f" ] && continue; [ -f "$f" ] || continue
  optout N8 "$f" && continue
  case "$f" in *AnalyticsCatalog.ts|*analytics-catalog.types.ts) continue;; esac
  added=$(git diff --cached -U0 -- "$f" | grep -E '^\+[^+]' || true)
  if echo "$added" | grep -qE "(PUBLIC_KINDS|COMPOSERS)[[:space:]]*[:=].*Record<string"; then
    echo "N8 BLOCK  $f — chart kinds belong in ANALYTICS_METRICS; the registry derives from it (one entry, not a new map)."
    HARD=$((HARD+1))
  fi
done < <(staged | grep -E '^apps/api/.*\.(ts|js)$' || true)

# N8c: a dense atom builder. A `for (…; i <= span; i++) { … atoms.push }` walk
#  pre-materializes empty calendar days the fold engine already synthesizes —
#  composers must emit SPARSE atoms (one per real-data row).
while IFS= read -r f; do
  [ -z "$f" ] && continue; [ -f "$f" ] || continue
  optout N8 "$f" && continue
  if grep -qE "for[[:space:]]*\(.*<=[[:space:]]*span" "$f" && grep -qE "atoms\.push" "$f"; then
    echo "N8 BLOCK  $f — dense per-day atom walk (for…<=span + atoms.push); emit sparse atoms (map real rows), the engine folds empties."
    HARD=$((HARD+1))
  fi
done < <(staged | grep -E '.*-atoms\.js$' || true)

# ── N9 — Shared chrome only (no hardcoded header/sidebar/shell) ────────────
#  Chrome (floating glass header + sidebar + shell) is defined ONCE in
#  apps/web/public/app-chrome.css. No page may redefine a chrome class in an
#  inline <style> or a page CSS — pages compose the shared chrome and add only
#  page-specific styles. Fires on an ADDED CSS rule for a chrome selector. The
#  single source (app-chrome.css) is exempt; per-file opt-out: arch-audit-ignore: N9.
while IFS= read -r f; do
  [ -z "$f" ] && continue; [ -f "$f" ] || continue
  optout N9 "$f" && continue
  case "$f" in *app-chrome.css) continue;; esac
  added=$(git diff --cached -U0 -- "$f" | grep -E '^\+[^+]' || true)
  if echo "$added" | grep -qE '^\+[[:space:]]*\.(public-header|public-header-inner|public-app|public-main|public-content|sidebar|app)[[:space:]]*\{'; then
    echo "N9 BLOCK  $f — chrome class defined here; chrome lives ONLY in app-chrome.css (the shared floating-glass DNA). Remove it and import the shared chrome."
    HARD=$((HARD+1))
  fi
done < <(staged | grep -E '^apps/web/public/.*\.(html|css|ts|tsx|js)$' || true)

[ "$SOFT" -gt 0 ] && echo "" && echo "$SOFT soft warning(s) (N1/N3) — not blocking."
if [ "$HARD" -gt 0 ]; then
  echo ""
  echo "$HARD hard violation(s). Fix them, or add 'arch-audit-ignore: <Nx>' if it's a sanctioned exception."
  exit 1
fi
exit 0
