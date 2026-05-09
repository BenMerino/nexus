const { sql } = require("./sql");
const { normalizeKey, similarity } = require("./normalize-name");

async function findCandidates(category, threshold = 0.7, tenantId = 1) {
  const filter = category
    ? await sql`
        SELECT DISTINCT ON (t.category, COALESCE(t.ext_id, t.value))
          t.category, t.value, t.ext_id FROM tags t
        JOIN doi_records d ON d.id = t.doi_record_id
        WHERE t.category = ${category} AND d.tenant_id = ${tenantId}`
    : await sql`
        SELECT DISTINCT ON (t.category, COALESCE(t.ext_id, t.value))
          t.category, t.value, t.ext_id FROM tags t
        JOIN doi_records d ON d.id = t.doi_record_id
        WHERE d.tenant_id = ${tenantId}`;

  const dismissed = await loadDismissed(tenantId);
  const synonyms = await loadSynonyms(tenantId);
  const tags = filter.rows;

  const byCategory = {};
  for (const t of tags) {
    if (!byCategory[t.category]) byCategory[t.category] = [];
    byCategory[t.category].push(t.value);
  }

  const candidates = [];
  for (const [cat, values] of Object.entries(byCategory)) {
    const groups = groupByKey(values);
    for (const group of groups) {
      if (group.length < 2) continue;
      if (isAllDismissed(cat, group, dismissed)) continue;
      if (isAlreadyMapped(cat, group, synonyms)) continue;
      const score = similarity(group[0], group[1]);
      if (score >= threshold) {
        candidates.push({ category: cat, values: group, score });
      }
    }
  }
  return candidates.sort((a, b) => b.score - a.score);
}

function groupByKey(values) {
  const map = new Map();
  for (const v of values) {
    const key = normalizeKey(v);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(v);
  }
  return [...map.values()];
}

async function loadDismissed(tenantId) {
  const { rows } = await sql`
    SELECT category, value_a, value_b FROM tag_dismissed_pairs
    WHERE tenant_id = ${tenantId}`;
  const set = new Set();
  for (const r of rows) {
    set.add(`${r.category}:${r.value_a}:${r.value_b}`);
    set.add(`${r.category}:${r.value_b}:${r.value_a}`);
  }
  return set;
}

function isAllDismissed(cat, group, dismissed) {
  for (let i = 0; i < group.length; i++) {
    for (let j = i + 1; j < group.length; j++) {
      if (!dismissed.has(`${cat}:${group[i]}:${group[j]}`)) return false;
    }
  }
  return true;
}

async function loadSynonyms(tenantId) {
  const { rows } = await sql`
    SELECT category, variant FROM tag_synonyms WHERE tenant_id = ${tenantId}`;
  const set = new Set();
  for (const r of rows) set.add(`${r.category}:${r.variant}`);
  return set;
}

function isAlreadyMapped(cat, group, synonyms) {
  const mapped = group.filter(v => synonyms.has(`${cat}:${v}`));
  return mapped.length >= group.length - 1;
}

module.exports = { findCandidates };
