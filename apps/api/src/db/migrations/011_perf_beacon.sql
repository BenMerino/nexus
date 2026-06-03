-- Schema migration: client-side page-load timing beacon.
--
-- WHY: the public tenant page (/t/:slug) feels slow to load for real users
-- (~10s: "Loading" → empty charts one-by-one → data), but every endpoint
-- measures fast from the developer's network. We can't fix what we can't see
-- from the client's vantage. This table records real-browser phase timings
-- (navigation → first paint → chrome-gate → each chart's recompose) so the
-- bottleneck is visible from where it actually hurts. Kept as standing
-- instrumentation, not a one-off probe.
--
-- Tenant-scoped (the page is public/anonymous, so user_id is null). `phase` is
-- a coarse label (e.g. 'shell','chart:publications.byIndex'); `ms` is the
-- elapsed time for that phase measured by the client via performance.now().
-- `nav_id` groups the phases of one page load. No PII — slug + phase + timing.

CREATE TABLE IF NOT EXISTS perf_beacon (
  id          BIGSERIAL PRIMARY KEY,
  tenant_id   INTEGER REFERENCES tenants(id),
  slug        TEXT,
  nav_id      TEXT NOT NULL,
  phase       TEXT NOT NULL,
  ms          INTEGER NOT NULL,
  ua          TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Query by tenant + recency for the perf dashboard / ad-hoc analysis.
CREATE INDEX IF NOT EXISTS idx_perf_beacon_tenant_time ON perf_beacon(tenant_id, created_at DESC);
