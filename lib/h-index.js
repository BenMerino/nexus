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

function getAuthorHIndexes(records) {
  const authorPapers = new Map();
  for (const r of records) {
    const authors = Array.isArray(r.authors)
      ? r.authors
      : JSON.parse(r.authors || "[]");
    const citations = r.citation_count || 0;
    for (const a of authors) {
      if (!authorPapers.has(a)) authorPapers.set(a, []);
      authorPapers.get(a).push(citations);
    }
  }

  const results = [];
  for (const [author, papers] of authorPapers) {
    results.push({
      author,
      hIndex: calculateHIndex(papers),
      paperCount: papers.length,
      totalCitations: papers.reduce((s, c) => s + c, 0),
    });
  }

  return results
    .filter((r) => r.hIndex > 0)
    .sort((a, b) => b.hIndex - a.hIndex);
}

module.exports = { calculateHIndex, getAuthorHIndexes };
