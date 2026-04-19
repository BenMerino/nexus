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
    issnL: loc?.source?.issn_l || null,
    indexedIn: work.indexed_in || [],
  };
}

module.exports = { normalizeWork };
