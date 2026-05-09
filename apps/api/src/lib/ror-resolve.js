const { sql } = require("./sql");
const { lookupInstitution } = require("./openalex");

// Batch-resolve institution tags to ROR canonical names
async function rorResolve(req, res, tenantId) {
  const { rows } = await sql`
    SELECT DISTINCT t.value FROM tags t
    JOIN doi_records d ON d.id = t.doi_record_id
    WHERE t.category = 'institution' AND d.tenant_id = ${tenantId}`;

  const { rows: existing } = await sql`
    SELECT variant FROM tag_synonyms
    WHERE category = 'institution' AND tenant_id = ${tenantId}`;
  const mapped = new Set(existing.map(r => r.variant));

  const toResolve = rows.map(r => r.value).filter(v => !mapped.has(v));
  const results = { resolved: 0, skipped: 0, removed: 0, total: toResolve.length, mappings: [] };
  const rorGroups = new Map();

  for (const value of toResolve) {
    try {
      const matches = await lookupInstitution(value);
      if (!matches.length || !matches[0].ror) {
        // No ROR match — this is junk, delete it
        await sql`DELETE FROM tags WHERE category = 'institution' AND value = ${value}`;
        results.removed++;
        continue;
      }
      const best = matches[0];
      if (!rorGroups.has(best.ror)) rorGroups.set(best.ror, { name: best.name, ror: best.ror, variants: [] });
      rorGroups.get(best.ror).variants.push(value);
    } catch (e) { results.skipped++; }
  }

  for (const [ror, group] of rorGroups) {
    for (const variant of group.variants) {
      if (variant === group.name) continue;
      await sql`
        INSERT INTO tag_synonyms (category, variant, canonical, source, tenant_id, ror_id)
        VALUES ('institution', ${variant}, ${group.name}, 'ror-auto', ${tenantId}, ${ror})
        ON CONFLICT(category, variant) DO UPDATE
        SET canonical = EXCLUDED.canonical, source = EXCLUDED.source, ror_id = EXCLUDED.ror_id`;
      results.resolved++;
      results.mappings.push({ variant: variant, canonical: group.name, ror });
    }
  }
  res.json(results);
}

module.exports = rorResolve;
