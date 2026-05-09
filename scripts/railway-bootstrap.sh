#!/usr/bin/env bash
# Configure all Railway services for the Nexus monorepo.
#
# Idempotent: re-running resets each service to the desired state.
# Source of truth for what each Railway service should look like.
#
# Mirrors apps/Zincro's scripts/railway-bootstrap.sh in shape and intent.
#
# Prereqs:
#   - railway CLI installed and authenticated (`railway login`)
#   - Linked to the right project (`railway link`, project: believable-creation)
#   - Each service already exists in the Railway dashboard:
#       * Postgres   (provisioned)
#       * Nexus      (API — create via "+ Create → GitHub Repo → BenMerino/nexus")
#       * Nexus-Web  (frontend — create from same repo)
#   - jq installed (`brew install jq`)
#
# Usage:
#   bash scripts/railway-bootstrap.sh                # configure all services
#   bash scripts/railway-bootstrap.sh Nexus          # configure one service
#   bash scripts/railway-bootstrap.sh --dry-run      # print what would change
#
# After running, trigger a fresh deploy:
#   railway up --service <name> --detach
#
# Note: `railway redeploy` reuses the cached image and ignores new config.
# A push to main or `railway up` is required to apply config changes.

set -euo pipefail

DRY_RUN=false
TARGET=""

for arg in "$@"; do
    case "$arg" in
        --dry-run) DRY_RUN=true ;;
        *) TARGET="$arg" ;;
    esac
done

# Service registry — single source of truth.
# Format: <service-name>|<workspace-name>|<app-dir>|<role: api|frontend>
SERVICES=(
    "Nexus|@nexus/api|apps/api|api"
    "Nexus-Web|@nexus/web|apps/web|frontend"
)

# Resolve service name → service ID via the live env config.
resolve_service_id() {
    local name="$1"
    railway environment config --json 2>/dev/null \
        | jq -r --arg n "$name" '
            .services
            | to_entries[]
            | select(.value.source.repo == "BenMerino/nexus" and (.value.networking.privateNetworkEndpoint // "" | ascii_downcase) == ($n | ascii_downcase))
            | .key
        ' | head -1
}

# Build the per-service patch object.
# api: no build step; tsx-equivalent (node) runs the Express entry directly,
#      Postgres URL referenced from the Postgres service.
# frontend: vite build in workspace, Railpack serves dist/ via the root
#      Caddyfile, parameterized by RAILPACK_SPA_OUTPUT_DIR + API_INTERNAL_URL.
build_patch() {
    local role="$1" workspace="$2" app_dir="$3"
    if [ "$role" = "api" ]; then
        jq -n --arg ws "$workspace" '{
            build: {
                builder: "RAILPACK",
                buildCommand: ""
            },
            deploy: {
                startCommand: ("npm run start --workspace=" + $ws),
                healthcheckPath: "/healthz"
            },
            variables: {
                POSTGRES_URL: { value: "${{Postgres.DATABASE_URL}}" },
                DATABASE_URL: { value: "${{Postgres.DATABASE_URL}}" },
                POSTGRES_PRISMA_URL: { value: "${{Postgres.DATABASE_URL}}" },
                POSTGRES_URL_NON_POOLING: { value: "${{Postgres.DATABASE_URL}}" },
                PGHOST: { value: "${{Postgres.PGHOST}}" },
                PGPORT: { value: "${{Postgres.PGPORT}}" },
                PGUSER: { value: "${{Postgres.PGUSER}}" },
                PGPASSWORD: { value: "${{Postgres.PGPASSWORD}}" },
                PGDATABASE: { value: "${{Postgres.PGDATABASE}}" }
            }
        }'
    else
        # Single root Caddyfile (read by Railpack at plan-generation time)
        # parameterizes per-service routing via env vars: RAILPACK_SPA_OUTPUT_DIR
        # picks the right SPA, API_INTERNAL_URL targets the API over Railway's
        # internal network on its private port (8080 by Railpack convention).
        jq -n --arg ws "$workspace" --arg dir "$app_dir" '{
            build: {
                builder: "RAILPACK",
                buildCommand: ("npm run build --workspace=" + $ws)
            },
            deploy: {
                startCommand: ""
            },
            variables: {
                RAILPACK_SPA_OUTPUT_DIR: { value: ($dir + "/dist") },
                API_INTERNAL_URL: { value: "nexus.railway.internal:8080" }
            }
        }'
    fi
}

apply_service() {
    local svc="$1" workspace="$2" app_dir="$3" role="$4"
    local sid
    sid=$(resolve_service_id "$svc")
    if [ -z "$sid" ]; then
        echo "  ⚠️  Service '$svc' not found in project. Create it in the dashboard first."
        return
    fi
    local patch
    patch=$(build_patch "$role" "$workspace" "$app_dir")
    local payload
    payload=$(jq -n --arg sid "$sid" --argjson p "$patch" '{services: {($sid): $p}}')

    echo "→ $svc ($role, sid=$sid)"
    if [ "$DRY_RUN" = true ]; then
        echo "$payload" | jq .
    else
        echo "$payload" | railway environment edit --json -m "bootstrap: $svc" > /dev/null
        echo "  ✓ config committed"
    fi
}

for entry in "${SERVICES[@]}"; do
    IFS='|' read -r svc ws dir role <<< "$entry"
    if [ -z "$TARGET" ] || [ "$TARGET" = "$svc" ]; then
        apply_service "$svc" "$ws" "$dir" "$role"
    fi
done

echo
echo "Done. Apply with a fresh deploy:"
echo "  railway up --service <name> --detach"
