const { sql } = require("./sql");

// Data layer (N4) for per-(tenant, user) UI preferences — the backend for the
// graph-engine's `useUserUiPref` hook. Scoped to the acting user via the scope
// object (tenant_id + user_id); `value` is an opaque JSONB blob the frontend
// owns. One row per (tenant, user, scope_key); writes upsert.

// Read one preference. Returns { scopeKey, value, updatedAt } or null when the
// user has never set this key (the hook then keeps its default).
async function getUiPref(scope, scopeKey) {
  const { rows } = await sql`
    SELECT value, updated_at
    FROM user_ui_prefs
    WHERE tenant_id = ${scope.tenantId} AND user_id = ${scope.userId} AND scope_key = ${scopeKey}`;
  if (!rows[0]) return null;
  return { scopeKey, value: rows[0].value, updatedAt: rows[0].updated_at };
}

// Upsert one preference. `value` is stored as JSONB verbatim. Returns the
// persisted record so the handler can echo it back.
async function setUiPref(scope, scopeKey, value) {
  const { rows } = await sql`
    INSERT INTO user_ui_prefs (tenant_id, user_id, scope_key, value, updated_at)
    VALUES (${scope.tenantId}, ${scope.userId}, ${scopeKey}, ${JSON.stringify(value)}::jsonb, now())
    ON CONFLICT (tenant_id, user_id, scope_key)
    DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    RETURNING value, updated_at`;
  return { scopeKey, value: rows[0].value, updatedAt: rows[0].updated_at };
}

module.exports = { getUiPref, setUiPref };
