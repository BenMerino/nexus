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

module.exports = { searchAuthors, fetchAuthorWorks };
