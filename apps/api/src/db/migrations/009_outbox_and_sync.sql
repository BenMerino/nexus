-- Schema migration: the tenant-data-lifecycle backbone.
--
-- WHY: Nexus governs the publication WRITE but no role owns a tenant's data as a
-- living thing (load → keep fresh → keep clean). This adds the durable state two
-- new things need:
--   1. A transactional OUTBOX so governor events survive cross-process (the web
--      process emits; a separate worker process consumes). The outbox row is the
--      source of truth (at-least-once); Postgres NOTIFY is just the wake-up. An
--      event can't exist without its data (same tx) nor fire on a rolled-back
--      write. The worker drains unprocessed rows, so a brief worker outage never
--      loses an event.
--   2. A staleness signal so "keep fresh" knows what to re-pull: per-(tenant,orcid)
--      last_synced_at lives on the authors row (which already IS that identity);
--      a per-tenant marker drives cheap scheduler eligibility (least-recently-run
--      first). NULL last_synced_at = never synced ⇒ full re-walk on first refresh.
--
-- Additive + idempotent.

-- ── Transactional outbox (durable cross-process event log) ──
CREATE TABLE IF NOT EXISTS event_outbox (
  id           BIGSERIAL PRIMARY KEY,
  tenant_id    INTEGER NOT NULL,
  channel      TEXT NOT NULL,                 -- the GovernorEventMap key, e.g. 'ingestion.completed'
  payload      JSONB NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ                    -- NULL = not yet consumed by the relay
);

-- Hot path: the relay claims the unprocessed tail in id order. Partial index keeps
-- it small once the bulk of rows are processed.
CREATE INDEX IF NOT EXISTS idx_outbox_unprocessed
  ON event_outbox (id) WHERE processed_at IS NULL;

-- ── Staleness signal ──
ALTER TABLE authors ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS last_lifecycle_run_at TIMESTAMPTZ;

-- "refresh oldest first" + "find stale": btree asc puts NULLs last by default, but
-- the staleness query drives off users LEFT JOIN authors, so NULL (never-synced)
-- authors are caught by the join, not the ordering. This index serves the scan.
CREATE INDEX IF NOT EXISTS idx_authors_tenant_synced
  ON authors (tenant_id, last_synced_at);

-- Scheduler eligibility: which tenant is least-recently serviced.
CREATE INDEX IF NOT EXISTS idx_tenants_lifecycle_run
  ON tenants (last_lifecycle_run_at);
