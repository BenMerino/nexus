const { canonicalize } = require("./normalize-tags");

function isPreprint(r) {
  return r.type ? canonicalize("type", r.type) === "preprint" : false;
}

/**
 * Calculates H-index for each author from a list of records. Preprints
 * are excluded — they're not peer-reviewed, so they shouldn't contribute
 * to anyone's h-index.
 */
function calculateHIndex(papers) {
  const sorted = papers.slice().sort((a, b) => b - a);
  let h = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] >= i + 1) h = i + 1;
    else break;
  }
  return h;
}

function hIndexByType(records) {
  const buckets = new Map();
  for (const r of records) {
    if (isPreprint(r)) continue;
    const type = r.type ? canonicalize("type", r.type) : null;
    if (!type) continue;
    if (!buckets.has(type)) buckets.set(type, []);
    buckets.get(type).push(r.citation_count || 0);
  }
  const byType = {};
  for (const [type, citations] of buckets) byType[type] = calculateHIndex(citations);
  return byType;
}

function authorName(a) {
  if (typeof a === "string") return a;
  if (a && typeof a === "object" && typeof a.name === "string") return a.name;
  return null;
}

function getAuthorHIndexes(records) {
  const authorRecords = new Map();
  for (const r of records) {
    if (isPreprint(r)) continue;
    const authors = Array.isArray(r.authors)
      ? r.authors
      : JSON.parse(r.authors || "[]");
    for (const a of authors) {
      const name = authorName(a);
      if (!name) continue;
      if (!authorRecords.has(name)) authorRecords.set(name, []);
      authorRecords.get(name).push(r);
    }
  }

  const results = [];
  for (const [author, recs] of authorRecords) {
    const citations = recs.map((r) => r.citation_count || 0);
    results.push({
      author,
      hIndex: calculateHIndex(citations),
      hIndexByType: hIndexByType(recs),
      paperCount: recs.length,
      totalCitations: citations.reduce((s, c) => s + c, 0),
    });
  }

  return results
    .filter((r) => r.hIndex > 0)
    .sort((a, b) => b.hIndex - a.hIndex);
}

module.exports = { calculateHIndex, hIndexByType, getAuthorHIndexes };
