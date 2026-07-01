-- Schema migration: composite index on publications(tenant_id, published).
--
-- WHY: the public page's time-series charts (cadence, velocity, byIndex, the
-- year-source series) all GROUP BY SUBSTRING(published FROM 1 FOR 4) scoped to
-- one tenant. The only index on `publications` was (tenant_id) and (doi), so
-- the planner fell back to a Seq Scan of the whole table for every one of
-- those charts on every load. The perf_beacon telemetry (migration 011) showed
-- these chart phases dominating real-user load time (p50 ~0.9-3.7s each).
--
-- Measured on prod (tenant 1, 93.7k publications): the year GROUP BY drops
-- from a 94ms Seq Scan to an 18ms Index Only Scan (~5x). The (tenant_id,
-- published) key is index-only-scannable for the year aggregates and narrows
-- hard under personal/unit scope where the tenant filter alone doesn't.
--
-- Additive + idempotent. No behavior change — pure read acceleration.
CREATE INDEX IF NOT EXISTS idx_publications_tenant_published
    ON publications (tenant_id, published);
