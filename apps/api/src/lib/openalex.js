const BASE = "https://api.openalex.org";

async function searchAuthors(query) {
  const resp = await fetch(`${BASE}/authors?search=${encodeURIComponent(query)}&per_page=10`);
  if (!resp.ok) return [];
  const data = await resp.json();
  return (data.results || []).map(a => ({
    id: a.id?.replace("https://openalex.org/", ""),
    name: a.display_name,
    worksCount: a.works_count || 0,
    citedByCount: a.cited_by_count || 0,
    institutions: (a.last_known_institutions || []).map(i => i.display_name).filter(Boolean),
  }));
}

async function fetchAuthorWorks(authorId, page = 1) {
  const url = `${BASE}/works?filter=author.id:${authorId}&per_page=50&page=${page}&select=doi`;
  const resp = await fetch(url);
  if (!resp.ok) return { dois: [], totalCount: 0, page, hasMore: false };
  const data = await resp.json();
  const dois = (data.results || [])
    .map(w => w.doi?.replace("https://doi.org/", ""))
    .filter(Boolean);
  const totalCount = data.meta?.count || 0;
  const hasMore = page * 50 < totalCount;
  return { dois, totalCount, page, hasMore };
}

// Search OpenAlex authors by name, restricted to one institution's ROR.
// Used by the ORCID helper: surfaces candidate profiles (with works_count,
// the key human signal) for an academic the roster left without an ORCID.
async function searchAuthorsAtInstitution(query, rorId, perPage = 5) {
  const ror = rorId.replace("https://ror.org/", "");
  const url = `${BASE}/authors?search=${encodeURIComponent(query)}&filter=affiliations.institution.ror:https://ror.org/${ror}&per_page=${perPage}&select=id,display_name,orcid,works_count,cited_by_count`;
  const resp = await fetch(url);
  if (!resp.ok) return [];
  const data = await resp.json();
  return (data.results || [])
    .map(a => ({
      id: a.id?.replace("https://openalex.org/", ""),
      name: a.display_name,
      orcid: a.orcid?.replace("https://orcid.org/", "") || null,
      worksCount: a.works_count || 0,
      citedByCount: a.cited_by_count || 0,
    }))
    .filter(a => a.orcid); // only candidates we can actually link
}

async function fetchWorksByOrcid(orcid, page = 1) {
  const url = `${BASE}/works?filter=author.orcid:${orcid}&per_page=50&page=${page}&select=doi`;
  const resp = await fetch(url);
  if (!resp.ok) return { dois: [], totalCount: 0, page, hasMore: false };
  const data = await resp.json();
  const dois = (data.results || [])
    .map(w => w.doi?.replace("https://doi.org/", ""))
    .filter(Boolean);
  const totalCount = data.meta?.count || 0;
  return { dois, totalCount, page, hasMore: page * 50 < totalCount };
}

async function fetchInstitutionAuthors(rorId, page = 1) {
  var ror = rorId.replace("https://ror.org/", "");
  var url = `${BASE}/authors?filter=affiliations.institution.ror:https://ror.org/${ror}&per_page=50&page=${page}&select=id,display_name,works_count,cited_by_count,orcid`;
  var resp = await fetch(url);
  if (!resp.ok) return { authors: [], totalCount: 0, page, hasMore: false };
  var data = await resp.json();
  var authors = (data.results || []).map(a => ({
    id: a.id?.replace("https://openalex.org/", ""),
    name: a.display_name,
    worksCount: a.works_count || 0,
    citedByCount: a.cited_by_count || 0,
    orcid: a.orcid?.replace("https://orcid.org/", "") || null,
  }));
  var totalCount = data.meta?.count || 0;
  return { authors, totalCount, page, hasMore: page * 50 < totalCount };
}

async function lookupInstitution(query) {
  var url = `${BASE}/institutions?search=${encodeURIComponent(query)}&per_page=3&select=id,display_name,ror`;
  var resp = await fetch(url);
  if (!resp.ok) return [];
  var data = await resp.json();
  return (data.results || []).map(i => ({
    id: i.id?.replace("https://openalex.org/", ""),
    name: i.display_name,
    ror: i.ror?.replace("https://ror.org/", "") || null,
  }));
}

module.exports = { searchAuthors, searchAuthorsAtInstitution, fetchAuthorWorks, fetchWorksByOrcid, fetchInstitutionAuthors, lookupInstitution };
