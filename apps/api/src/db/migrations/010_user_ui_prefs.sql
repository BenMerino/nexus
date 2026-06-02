-- Schema migration: per-(tenant, user) UI preferences.
--
-- WHY: the carbon-copied graph-engine ships `useUserUiPref` (hooks/useUserUiPref.ts),
-- which reads/writes GET/PUT /api/user-ui-prefs/:scopeKey to persist small UI
-- choices server-side (e.g. a chart's enabled feature overlays). Nexus copied the
-- frontend hook but never ported the backend, so every chart that mounts
-- ChartBody/FeatureToggleGroup fired a 404 (the hook degrades to defaults, so it
-- was noise, not a crash). This table + handler close that gap.
--
-- SHAPE: a tenant-scoped key/value store keyed by (tenant_id, user_id, scope_key).
-- `value` is an opaque JSONB blob whose shape the FRONTEND owns per scope_key
-- convention ('<surface>:<id>:<facet>'); the server just stores/returns it.
-- One row per (user, scope_key); upsert on write.

CREATE TABLE IF NOT EXISTS user_ui_prefs (
  tenant_id   INTEGER NOT NULL REFERENCES tenants(id),
  user_id     INTEGER NOT NULL REFERENCES users(id),
  scope_key   TEXT    NOT NULL,
  value       JSONB   NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id, scope_key)
);
