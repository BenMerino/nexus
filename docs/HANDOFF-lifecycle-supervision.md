# Handoff — Tenant Data Lifecycle Supervision (built 2026-06-02)

DGA roles now own a tenant's data lifecycle — provision → load → keep-fresh → keep-clean — with a process-isolated worker + a durable cross-process event backbone (gold-standard for the pg-only stack). Plan: `~/.claude/plans/sleepy-discovering-music.md`. Design: `DGA_DESIGN.md` §Lifecycle.

## What's built (all phases, code complete + verified)
- **Migration 009** (`009_outbox_and_sync.sql`): `event_outbox`, `authors.last_synced_at`, `tenants.last_lifecycle_run_at` + indexes. Additive/idempotent, runs on web boot.
- **Event backbone**: `EventBus.emit` now ALSO enqueues an outbox row + `NOTIFY nexus_events` (fire-and-forget on the pool; in-process `emit` unchanged). `db-outbox.js` = enqueue/claim/markProcessed. `OutboxRelay.ts` (worker) LISTENs + drains → re-emits into the worker's bus with persist OFF (no loop), at-least-once.
- **Lifecycle domain** (`services/lifecycle/`): `Assessor` (Resolver → `AssessmentPlan`), `MaintenanceResolver` (dup-institution finder, suggest-only), `RefreshWorkflow` (since-aware OpenAlex pull → IngestionWorkflow → stamp), `MaintenanceWorkflow` (survey + confirmed merge), `LifecycleWorkflow.runTenant` (assess→refresh→survey→mark), `LifecycleScheduler` (worker-only tick, durable cadence, fairness, overlap guard), `lifecycle-listeners` (events→kick), `lifecycle-status`.
- **Provision**: `InstitutionGovernor.provision` (governed `tenants` write, emits `tenant.provisioned`); `auth.js` create-tenant repointed. `RorDispatcher.suggestRor` (OpenAlex name→ROR).
- **Worker**: `worker.js` → `node dist/worker.js` — bootstrap + relay + listeners + scheduler, SIGTERM drain. Does NOT run migrations (web owns them).
- **Endpoint** `handlers/lifecycle.js` (`/api/lifecycle`): `assess`/`refresh`/`maintain`/`merge-institutions`/`status`/`suggest-ror`. Gated superadmin or tenant_admin.
- Events added: `tenant.provisioned`, `roster.imported`. `roster.imported` emitted from `users-import`.

## Infra (DONE 2026-06-02)
**Railway worker service `Nexus-Worker` is live** (project believable-creation): repo `BenMerino/nexus`@main, build `npm run build --workspace=@nexus/api`, start `npm run start:worker --workspace=@nexus/api` (`node dist/worker.js`), `restartPolicyType: ON_FAILURE`, `DATABASE_URL`/`POSTGRES_URL` → `${{Postgres.DATABASE_URL}}` (shared, private network). Verified up: logs show `[bootstrap] DGA wired`, `[OutboxRelay] LISTENing on nexus_events`, `[LifecycleScheduler] started (tick 6h, min-interval 20h)`.
- **`nexus-cron` was RETIRED** (deleted) — it ran `scripts/daily-ingest.js` nightly, which the worker's scheduler now subsumes (and the worker also reacts in real time). Both `railway.cron.json` and `apps/api/scripts/daily-ingest.js` removed as dead.
- Tunable env on the worker (Railway vars): `LIFECYCLE_TICK_MS` (default 6h), `LIFECYCLE_MIN_INTERVAL_H` (20h), `LIFECYCLE_MAX_ORCIDS` (25).
- The web process still fills `event_outbox`; the worker drains it (LISTEN + 30s poll). Manual `/api/lifecycle?action=refresh` also works in the web process.

## Verification (railway ssh + endpoints)
1. **009 applied:** `railway ssh --service Nexus "cd /app/apps/api && node -e \"require('./dist/src/lib/sql').sql\\\`SELECT to_regclass('event_outbox')\\\`.then(r=>console.log(r.rows))\""` → non-null.
2. **Assess (read-only):** `GET /api/lifecycle?action=assess&tenant_id=1` → plan; cross-check `summary.stale`.
3. **Outbox fills:** submit a DOI / import roster → a row appears in `event_outbox` (worker drains it once up; `processed_at` set).
4. **Refresh idempotence:** `POST /api/lifecycle?action=refresh&tenant_id=1&max=5` twice → 2nd imports ~0, `authors.last_synced_at` advances.
5. **Maintain:** `GET ...action=maintain` → duplicate-institution candidates (suggest-only).
6. **Provision:** `GET ...action=suggest-ror&name=Universidad%20de%20Talca` → ROR candidates; create-tenant → `tenant.provisioned` outbox row → worker kicks first refresh.
7. **Scheduler (worker up):** watch worker logs for one-tenant-per-tick rotation + `isRunning` skip on overlap.

## Notes / deviations (honest)
- **No auto-merge of institutions** — all institutions carry a ROR, so the only dup case is same-name/different-ROR (a real conflict, e.g. university vs its hospital). Surfaced for human review; `merge-institutions` executes only an explicit id-pair.
- **Outbox enqueue is best-effort on the pool** (not in the governor's tx — ingest writes still use the plain `sql` pool, no tx; pairs with the future RLS/withTenant track). The relay + nightly scan are the at-least-once safety net, so a dropped enqueue is recoverable, not fatal. To make it truly atomic, thread a tx client into `enqueueEvent` when the governors move to `withTenant`.
- **Status endpoint reads durable DB state** (`tenants.last_lifecycle_run_at` + audit rows), not the worker's in-memory map (cross-process — web can't see worker memory).
