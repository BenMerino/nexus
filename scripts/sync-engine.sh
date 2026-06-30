#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# sync-engine.sh — sync nexus's vendored chart engine FROM Zincro (authoritative).
#
# Zincro (git@github.com:BenMerino/Sincro.git) owns the shared engine surface
# under packages/shared/src/. nexus vendors a copy under apps/web/. This script
# pulls the boundary from Zincro's git remote at a pinned ref so engine fixes
# reach nexus via one command instead of manual copying.
#
# MODES
#   (default)  dry-run report: per-file would-create/overwrite/identical/skip,
#              plus a DRIFT-UP flag where nexus differs (a candidate fix Zincro
#              may lack). NO writes.
#   --apply    perform the writes (create/overwrite boundary files).
#   --check    exit non-zero if the mirror has drifted from the pinned ref
#              (excluding the exclusion list). For pre-push / CI.
#
# SOURCE
#   Fetches Zincro from its git remote into .engine-src/ (gitignored), pinned to
#   $ZINCRO_REF (default origin/main). Prints the resolved SHA every run.
#   If $ZINCRO_ROOT points at a local Zincro checkout, that's used as a fast
#   path; otherwise the remote clone/fetch is used (works standalone).
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail   # NOT -e: diff -q and arithmetic returns are intentionally nonzero in the report loop

ZINCRO_REMOTE="git@github.com:BenMerino/Sincro.git"
ZINCRO_REF="${ZINCRO_REF:-origin/main}"
NEXUS_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CACHE="$NEXUS_ROOT/.engine-src/zincro"

MODE="dryrun"
case "${1:-}" in
  --apply) MODE="apply" ;;
  --check) MODE="check" ;;
  ""|--dry-run|--dryrun) MODE="dryrun" ;;
  *) echo "usage: $0 [--apply|--check]"; exit 2 ;;
esac

# ── Resolve Zincro source (local fast-path or remote clone) ──────────────────
if [ -n "${ZINCRO_ROOT:-}" ] && [ -d "$ZINCRO_ROOT/packages/shared/src" ]; then
  ZSRC="$ZINCRO_ROOT/packages/shared/src"
  ZSHA="$(cd "$ZINCRO_ROOT" && git rev-parse HEAD 2>/dev/null || echo 'local-worktree')"
  echo "[sync-engine] source: LOCAL $ZINCRO_ROOT  sha=$ZSHA"
else
  if [ ! -d "$CACHE/.git" ]; then
    mkdir -p "$(dirname "$CACHE")"
    git clone --no-checkout --filter=blob:none "$ZINCRO_REMOTE" "$CACHE" >/dev/null 2>&1
  fi
  ( cd "$CACHE" && git fetch --filter=blob:none origin >/dev/null 2>&1 )
  ZSHA="$(cd "$CACHE" && git rev-parse "$ZINCRO_REF")"
  ( cd "$CACHE"
    git sparse-checkout init --no-cone >/dev/null 2>&1
    git sparse-checkout set \
      'packages/shared/src/ui/graph-engine' \
      'packages/shared/src/ui/visual-lang' \
      'packages/shared/src/ui/composed' \
      'packages/shared/src/ui/primitives' \
      'packages/shared/src/architect' >/dev/null 2>&1
    git checkout "$ZINCRO_REF" >/dev/null 2>&1 )
  ZSRC="$CACHE/packages/shared/src"
  echo "[sync-engine] source: REMOTE $ZINCRO_REMOTE  ref=$ZINCRO_REF  sha=$ZSHA"
fi
NXUI="$NEXUS_ROOT/apps/web"

# ── Boundary definition ──────────────────────────────────────────────────────
# Full-mirror dirs: every Zincro file syncs (recursively). aurora is the GPU
# "living button" layer BaseAction's aurora variant depends on — full mirror so
# upstream shader/palette fixes cascade.
FULL_MIRROR_DIRS=( "ui/graph-engine" "ui/visual-lang" "ui/aurora" )
# Curated subset dirs: ONLY the files nexus already vendors sync (Zincro's dir
# has 100s of files nexus doesn't want). New files are NOT pulled automatically.
SUBSET_DIRS=( "ui/composed" "ui/primitives" )
# Explicit loose ui/ files (no dir of their own) the engine/DNA layer depends on.
UI_FILES=( "ui/motion-presets.ts" )
# Files from packages/shared/src ROOT (not under ui/) that nexus vendors. Each
# entry "ZINCRO_REL|NEXUS_REL": Zincro path under packages/shared/src → nexus
# path under apps/web. dna-defaults.css is the DNA token root the primitives
# are built against (nexus puts it in public/ so shared.css can @import it).
SHARED_FILES=( "dna-defaults.css|public/dna-defaults.css" )
# Explicit architect files (the engine's ONLY architect deps). chart-kpi.types
# + graph-directive-runtime.types are pulled if present on Zincro.
ARCHITECT_FILES=( bucket-sequence.ts fold-atoms.ts fold-atoms-calendar.ts \
  fold-atoms-grid.ts graph-composer.types.ts graph-features.types.ts \
  place-atoms.ts replayable-directive.ts chart-kpi.types.ts \
  graph-directive-runtime.types.ts )

# ── Exclusions (nexus-owned — never overwritten) ─────────────────────────────
# Matched by path RELATIVE to apps/web. nexus-only files (no Zincro counterpart)
# are auto-detected and kept; these are files that EXIST on Zincro but nexus owns.
is_excluded() {
  case "$1" in
    ui/graph-engine/engine-visual-defaults.ts) return 0 ;;  # per-app square corners (0/0)
    ui/graph-engine/ChartTuningContext.tsx)    return 0 ;;  # nexus glow-0 seam + host tuning fetch
    ui/graph-engine/index.ts)                  return 0 ;;  # nexus barrel: re-exports DirectiveChart
    # FLOW-UP PENDING: ChartChromeLayer.tsx carries nexus's fmtTick thousands
    # fix (2403→2,403) that Zincro lacks. Excluded so --check is green; REMOVE
    # this line once the fix is merged upstream, then it syncs clean.
    ui/graph-engine/ChartChromeLayer.tsx)      return 0 ;;  # nexus-ahead: fmtTick thousands (flow up)
    # nexus-ahead: hideFrame seed implies bare (no engine card border/bg/radius)
    # so a host-card-wrapped chart doesn't draw a second border. Generic fix —
    # flow UP to Zincro, then REMOVE this line so it syncs clean.
    ui/graph-engine/GraphRender.tsx)           return 0 ;;  # nexus-ahead: hideFrame→bare (flow up)
    ui/graph-engine/__tests__/*)               return 0 ;;  # Zincro tests, not vendored
    *) return 1 ;;
  esac
}

# ── Reporting state ──────────────────────────────────────────────────────────
declare -i n_create=0 n_over=0 n_ident=0 n_skip=0 n_drift=0
DRIFT_FILES=()

# classify + (optionally) copy one file. args: <zincro-abs> <nexus-rel>
handle() {
  local zf="$1" rel="$2" nf="$NXUI/$2"
  if is_excluded "$rel"; then
    printf '  %-11s %s\n' "SKIP(excl)" "$rel"; n_skip+=1; return
  fi
  if [ ! -f "$nf" ]; then
    printf '  %-11s %s\n' "CREATE" "$rel"; n_create+=1
    [ "$MODE" = "apply" ] && { mkdir -p "$(dirname "$nf")"; cp "$zf" "$nf"; }
    return
  fi
  if diff -q "$zf" "$nf" >/dev/null 2>&1; then
    n_ident+=1; return   # identical: silent in report (noise reduction)
  fi
  printf '  %-11s %s\n' "OVERWRITE" "$rel"; n_over+=1; DRIFT_FILES+=("$rel")
  [ "$MODE" = "apply" ] && cp "$zf" "$nf"
}

echo ""
MODE_UC="$(echo "$MODE" | tr '[:lower:]' '[:upper:]')"
echo "════════ ENGINE SYNC ${MODE_UC} — nexus ← Zincro@${ZSHA:0:12} ════════"

# Full-mirror dirs (recursive)
for d in "${FULL_MIRROR_DIRS[@]}"; do
  echo "── $d (full mirror) ──"
  [ -d "$ZSRC/$d" ] || { echo "  (zincro dir missing)"; continue; }
  while IFS= read -r zf; do
    rel="$d/${zf#"$ZSRC/$d/"}"
    handle "$zf" "$rel"
  done < <(find "$ZSRC/$d" -type f | sort)
  # nexus-only files in this dir (no Zincro counterpart) — kept, reported
  while IFS= read -r nf; do
    rel="$d/${nf#"$NXUI/$d/"}"
    [ -f "$ZSRC/$rel" ] || printf '  %-11s %s\n' "NEXUS-ONLY" "$rel"
  done < <(find "$NXUI/$d" -type f 2>/dev/null | sort)
done

# Subset dirs (only files nexus already has)
for d in "${SUBSET_DIRS[@]}"; do
  echo "── $d (curated subset — only vendored files) ──"
  while IFS= read -r nf; do
    rel="$d/${nf#"$NXUI/$d/"}"
    if [ -f "$ZSRC/$rel" ]; then handle "$ZSRC/$rel" "$rel"
    else printf '  %-11s %s\n' "NEXUS-ONLY" "$rel"; fi
  done < <(find "$NXUI/$d" -type f 2>/dev/null | sort)
done

# Architect explicit files
echo "── architect (explicit engine deps) ──"
for f in "${ARCHITECT_FILES[@]}"; do
  zf="$ZSRC/architect/$f"
  [ -f "$zf" ] && handle "$zf" "architect/$f" || true
done

# Explicit loose ui/ files
echo "── ui (explicit loose files) ──"
for rel in "${UI_FILES[@]}"; do
  zf="$ZSRC/${rel#ui/}"; zf="$ZSRC/${rel}"
  # Zincro path mirrors nexus rel (ui/motion-presets.ts → packages/shared/src/ui/motion-presets.ts)
  [ -f "$zf" ] && handle "$zf" "$rel" || printf '  %-11s %s\n' "Z-MISSING" "$rel"
done

# Shared-root files (Zincro packages/shared/src ROOT → arbitrary nexus path)
echo "── shared root (explicit, src|dest) ──"
for pair in "${SHARED_FILES[@]}"; do
  zrel="${pair%%|*}"; nrel="${pair##*|}"
  zf="$ZSRC/$zrel"
  [ -f "$zf" ] && handle "$zf" "$nrel" || printf '  %-11s %s\n' "Z-MISSING" "$zrel"
done

# ── Drift-UP detection: nexus OVERWRITE files may carry fixes Zincro lacks ────
echo ""
echo "════════ DRIFT (nexus differs from Zincro — review direction) ════════"
if [ ${#DRIFT_FILES[@]} -eq 0 ]; then
  echo "  none — mirror matches Zincro (excluding exclusions)."
else
  echo "  These files differ. A sync would pull Zincro DOWN onto them. If any"
  echo "  nexus change is a real fix Zincro lacks, it must flow UP to Zincro FIRST:"
  for rel in "${DRIFT_FILES[@]}"; do echo "    • $rel"; done
fi

echo ""
echo "════════ SUMMARY ════════"
echo "  create=$n_create overwrite=$n_over identical=$n_ident skip=$n_skip"
echo "  zincro-sha=$ZSHA"

if [ "$MODE" = "check" ]; then
  [ "$n_create" -gt 0 ] || [ "$n_over" -gt 0 ] && { echo "  → DRIFTED (check failed)"; exit 1; }
  echo "  → in sync"; exit 0
fi
[ "$MODE" = "dryrun" ] && echo "  (dry-run — no files written. Re-run with --apply to sync.)"
exit 0
