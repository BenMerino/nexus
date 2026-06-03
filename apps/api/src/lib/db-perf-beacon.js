const { sql } = require("./sql");

// Data layer (N4) for the client load-timing beacon. One INSERT per phase
// row; the public page POSTs a batch (one nav_id, many phases) which the
// handler unrolls into rows. Tenant resolved by slug server-side (anonymous
// page → no scope), so the client can't spoof another tenant's id.

async function recordBeacon(tenantId, slug, navId, phases, ua) {
  // phases: [{ phase: string, ms: number }]. Bulk insert via a single
  // multi-row VALUES — at most ~10 rows per load, so no batching needed.
  const rows = (phases || [])
    .filter((p) => p && typeof p.phase === "string" && Number.isFinite(p.ms))
    .slice(0, 30); // cap: a load has <~15 phases; ignore anything pathological
  if (!rows.length) return 0;
  for (const p of rows) {
    await sql`
      INSERT INTO perf_beacon (tenant_id, slug, nav_id, phase, ms, ua)
      VALUES (${tenantId}, ${slug}, ${navId}, ${p.phase}, ${Math.round(p.ms)}, ${ua || null})`;
  }
  return rows.length;
}

// Recent load timings for a tenant, aggregated per phase (p50/p95-ish via
// avg/max over the window) — the shape a perf dashboard or ad-hoc check reads.
async function recentBeaconStats(tenantId, limitLoads = 200) {
  const r = await sql`
    SELECT phase,
           COUNT(*) AS samples,
           ROUND(AVG(ms)) AS avg_ms,
           MAX(ms) AS max_ms
    FROM perf_beacon
    WHERE tenant_id = ${tenantId}
      AND created_at > now() - interval '7 days'
    GROUP BY phase
    ORDER BY avg_ms DESC
    LIMIT ${limitLoads}`;
  return r.rows.map((row) => ({
    phase: row.phase, samples: parseInt(row.samples),
    avgMs: parseInt(row.avg_ms), maxMs: parseInt(row.max_ms),
  }));
}

module.exports = { recordBeacon, recentBeaconStats };
