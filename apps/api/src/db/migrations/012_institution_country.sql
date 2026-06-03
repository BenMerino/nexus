-- Schema migration: normalize `country` onto the institution entity.
--
-- WHY: the public "Publicaciones por país" donut was the slowest chart (~1s) —
-- the ONLY one that shredded the 57MB denormalized `affiliations` JSON column
-- (jsonb_array_elements over every publication) just to count countries.
-- Country lived ONLY inside that JSON blob; the normalized entity model
-- (affiliated_with → institutions) had no country, so the clean join didn't
-- exist. This is the foundational fix (per DGA: no JSON-in-SQL "inception",
-- no symptom-masking materialized cache): country becomes a first-class column
-- on `institutions`, populated at ingest by the InstitutionGovernor
-- (upsertInstitutions reads aff.country). getCountries then aggregates via a
-- plain indexed join — the same cheap path as collaborators (~230ms), with no
-- JSON shredding anywhere.
--
-- Additive + idempotent. Existing rows backfilled by
-- scripts/backfill-institution-country.js (extracts country from the JSON once);
-- future ingests populate it inline.

ALTER TABLE institutions ADD COLUMN IF NOT EXISTS country TEXT;

-- The donut reads: GROUP BY country over a tenant's affiliated institutions.
CREATE INDEX IF NOT EXISTS idx_institutions_country ON institutions(tenant_id, country);
