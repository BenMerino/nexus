// API fetchers for DOI metadata sources

async function fetchCrossRef(doi) {
  const resp = await fetch(
    `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
    {
      headers: {
        "User-Agent": "DOI-Checker/1.0 (mailto:dev@example.com)",
      },
    }
  );
  if (!resp.ok) return { found: false };
  const data = await resp.json();
  const msg = data.message;
  return {
    found: true,
    title: msg.title?.[0],
    authors: msg.author?.map((a) => ({
      name: `${a.given || ""} ${a.family || ""}`.trim(),
      affiliations: a.affiliation?.map((af) => af.name).filter(Boolean) || [],
    })),
    published: msg.published?.["date-parts"]?.[0]?.join("-"),
    journal: msg["container-title"]?.[0],
    type: msg.type,
    publisher: msg.publisher,
    url: msg.URL,
  };
}

async function fetchOpenAlex(doi) {
  const resp = await fetch(`https://api.openalex.org/works/doi:${doi}`);
  if (!resp.ok) return { found: false };
  const data = await resp.json();
  return {
    found: true,
    title: data.title,
    authors: data.authorships?.map((a) => ({
      name: a.author?.display_name,
      orcid: a.author?.orcid?.replace("https://orcid.org/", "") || null,
      affiliations: a.institutions?.map((i) => ({
        name: i.display_name,
        ror: i.ror,
        country: i.country_code,
        type: i.type,
      })).filter((i) => i.name) || [],
    })),
    published: data.publication_date,
    journal: data.primary_location?.source?.display_name,
    citedByCount: data.cited_by_count,
    openAccess: data.open_access?.is_oa,
    oaUrl: data.open_access?.oa_url,
    type: data.type,
  };
}

async function fetchSemanticScholar(doi) {
  const resp = await fetch(
    `https://api.semanticscholar.org/graph/v1/paper/DOI:${doi}?fields=title,authors,authors.affiliations,year,citationCount,influentialCitationCount,abstract,venue,openAccessPdf`
  );
  if (!resp.ok) return { found: false };
  const data = await resp.json();
  return {
    found: true,
    title: data.title,
    authors: data.authors?.map((a) => ({
      name: a.name,
      affiliations: a.affiliations || [],
    })),
    year: data.year,
    venue: data.venue,
    citationCount: data.citationCount,
    influentialCitations: data.influentialCitationCount,
    abstract: data.abstract,
    openAccessPdf: data.openAccessPdf?.url,
  };
}

async function fetchDataCite(doi) {
  const resp = await fetch(
    `https://api.datacite.org/dois/${encodeURIComponent(doi)}`
  );
  if (!resp.ok) return { found: false };
  const data = await resp.json();
  const attrs = data.data?.attributes;
  if (!attrs) return { found: false };
  return {
    found: true,
    title: attrs.titles?.[0]?.title,
    authors: attrs.creators?.map((c) => ({
      name: c.name,
      affiliations: c.affiliation?.map((af) => af.name || af).filter(Boolean) || [],
    })),
    published: attrs.publicationYear,
    publisher: attrs.publisher,
    type: attrs.types?.resourceTypeGeneral,
  };
}

function unwrap(result) {
  if (result.status === "fulfilled") return result.value;
  return { found: false, error: result.reason?.message || "Unknown error" };
}

module.exports = { fetchCrossRef, fetchOpenAlex, fetchSemanticScholar, fetchDataCite, unwrap };
