const { canonicalize } = require("./normalize-tags");

/**
 * Calculates H-index for each author from a list of records.
 * H-index: an author has index h if h of their papers have >= h citations.
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
    const type = r.type ? canonicalize("type", r.type) : null;
    if (!type) continue;
    if (!buckets.has(type)) buckets.set(type, []);
    buckets.get(type).push(r.citation_count || 0);
  }
  const byType = {};
  for (const [type, citations] of buckets) byType[type] = calculateHIndex(citations);
  return byType;
}

function getAuthorHIndexes(records) {
  const authorRecords = new Map();
  for (const r of records) {
    const authors = Array.isArray(r.authors)
      ? r.authors
      : JSON.parse(r.authors || "[]");
    for (const a of authors) {
      if (!authorRecords.has(a)) authorRecords.set(a, []);
      authorRecords.get(a).push(r);
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
