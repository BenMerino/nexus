const BASE = "https://api.openalex.org";

async function fetchInstitutionWorks(rorId, cursor = "*", perPage = 200) {
  const filter = `authorships.institutions.ror:${rorId}`;
  const url = `${BASE}/works?filter=${encodeURIComponent(filter)}&per_page=${perPage}&cursor=${cursor}&select=doi,title,authorships,publication_date,primary_location,locations,cited_by_count,open_access,type`;
  const resp = await fetch(url);
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OpenAlex error ${resp.status}: ${text}`);
  }
  const data = await resp.json();
  return {
    works: data.results || [],
    nextCursor: data.meta?.next_cursor || null,
    totalCount: data.meta?.count || 0,
  };
}

async function fetchInstitutionInfo(rorId) {
  const url = `${BASE}/institutions?filter=ror:${rorId}`;
  const resp = await fetch(url);
  if (!resp.ok) return null;
  const data = await resp.json();
  const inst = data.results?.[0];
  if (!inst) return null;
  return {
    id: inst.id,
    name: inst.display_name,
    ror: inst.ror,
    country: inst.country_code,
    worksCount: inst.works_count,
  };
}

module.exports = { fetchInstitutionWorks, fetchInstitutionInfo };
