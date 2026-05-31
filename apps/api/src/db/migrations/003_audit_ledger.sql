-- DGA audit ledger (Phase 2).
--
-- Every Governor write appends one row here via BaseGovernor.logToLedger ->
-- AuditPort.appendLog (impl in src/services/AuditLedger.ts). Records WHO did
-- WHAT to WHICH entity, WHEN — the deterministic write trail behind the DGA.
--
-- entity_id is the DGA entity-ref string ("<kind>:<id>", e.g. publication:1247,
-- author:0000-0002-...) per .claude/rules/id-taxonomy.md — text, not an FK, so
-- one table spans every aggregate.
--
-- tenant_id present for tenant-scoped queries and so this table joins the RLS
-- rollout later. SERIAL append stream; never updated or deleted in normal use.

CREATE TABLE IF NOT EXISTS audit_log (
  id          BIGSERIAL PRIMARY KEY,
  tenant_id   INTEGER NOT NULL,
  entity_id   TEXT NOT NULL,
  action      TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_entity
  ON audit_log (tenant_id, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_created
  ON audit_log (tenant_id, created_at DESC);
