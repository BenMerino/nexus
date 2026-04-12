const { sql } = require("@vercel/postgres");
const { normalizeKey, similarity } = require("./normalize-name");

async function findCandidates(category, threshold = 0.7) {
  const filter = category
    ? await sql`SELECT DISTINCT category, value FROM tags WHERE category = ${category}`
    : await sql`SELECT DISTINCT category, value FROM tags`;

  const dismissed = await loadDismissed();
  const synonyms = await loadSynonyms();
  const tags = filter.rows;

  // Group by category
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

async function loadDismissed() {
  const { rows } = await sql`SELECT category, value_a, value_b FROM tag_dismissed_pairs`;
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

async function loadSynonyms() {
  const { rows } = await sql`SELECT category, variant FROM tag_synonyms`;
  const set = new Set();
  for (const r of rows) set.add(`${r.category}:${r.variant}`);
  return set;
}

function isAlreadyMapped(cat, group, synonyms) {
  const mapped = group.filter(v => synonyms.has(`${cat}:${v}`));
  return mapped.length >= group.length - 1; // all but canonical are mapped
}

module.exports = { findCandidates };
