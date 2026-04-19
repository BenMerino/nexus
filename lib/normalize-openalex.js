function normalizeWork(work) {
  const doi = work.doi?.replace("https://doi.org/", "");
  if (!doi) return null;

  const authors = (work.authorships || []).map((a) => ({
    name: a.author?.display_name,
    orcid: a.author?.orcid?.replace("https://orcid.org/", "") || null,
    affiliations: (a.institutions || [])
      .map((i) => ({ name: i.display_name, ror: i.ror, country: i.country_code, type: i.type }))
      .filter((i) => i.name),
  }));

  const loc = work.primary_location;
  return {
    doi,
    title: work.title,
    authors,
    authorNames: authors.map((a) => a.name).filter(Boolean),
    published: work.publication_date,
    journal: loc?.source?.display_name || null,
    publisher: null,
    type: work.type,
    citationCount: work.cited_by_count || 0,
    openAccess: work.open_access?.is_oa || false,
    openAccessUrl: work.open_access?.oa_url || null,
    abstract: null,
    venue: loc?.source?.display_name || null,
    url: work.doi ? `https://doi.org/${doi}` : null,
    sourceIndices: extractSourceIndices(work),
  };
}

function extractSourceIndices(work) {
  const sources = new Set();
  for (const loc of work.locations || []) {
    const name = loc.source?.display_name?.toLowerCase() || "";
    const type = loc.source?.type || "";
    if (loc.source?.is_in_doaj) sources.add("DOAJ");
    if (name.includes("scielo") || loc.source?.host_organization_name?.toLowerCase().includes("scielo")) {
      sources.add("SciELO");
    }
    if (type === "journal" || type === "conference") {
      if (!sources.has("SciELO")) sources.add("indexed");
    }
  }
  const idx = work.indexed_in || work.indexedIn;
  if (Array.isArray(idx)) {
    for (const src of idx) {
      if (src === "crossref") sources.add("Crossref");
      if (src === "doaj") sources.add("DOAJ");
    }
  }
  return [...sources];
}

module.exports = { normalizeWork, extractSourceIndices };
