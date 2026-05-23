const { sql } = require("./sql");
const { fetchInstitutionAuthors } = require("./openalex");

// Normalize a name for matching: strip accents, lowercase, collapse to a
// sorted set of word tokens. Sorting makes "Cartes Sanhueza Jorge" match
// OpenAlex's "Jorge Cartes Sanhueza" regardless of given/surname order.
function nameKey(name) {
  const tokens = (name || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort();
  return tokens.join(" ");
}

// Pull every UTalca author from OpenAlex (paged) and index them by nameKey.
// Only authors that carry an ORCID are useful for linking.
async function buildAuthorIndex(ror, maxPages = 40) {
  const index = new Map(); // nameKey -> [{ name, orcid }]
  let page = 1;
  while (page <= maxPages) {
    const batch = await fetchInstitutionAuthors(ror, page);
    for (const a of batch.authors) {
      if (!a.orcid) continue;
      const key = nameKey(a.name);
      if (!index.has(key)) index.set(key, []);
      index.get(key).push({ name: a.name, orcid: a.orcid });
    }
    if (!batch.hasMore) break;
    page++;
  }
  return index;
}

// Match tenant's ORCID-less academic users against the OpenAlex author index.
// Conservative: link only when exactly one ORCID maps to the user's nameKey.
// Anything ambiguous (0 or >1 candidates) is reported, never auto-linked.
async function resolveOrcids(tenantId, ror) {
  const index = await buildAuthorIndex(ror);
  const { rows: users } = await sql`
    SELECT id, full_name FROM users
    WHERE tenant_id = ${tenantId} AND role = 'academic'
      AND (orcid IS NULL OR orcid = '')`;

  const result = { linked: 0, flagged: [], unmatched: 0, candidates: index.size };
  for (const u of users) {
    const matches = index.get(nameKey(u.full_name)) || [];
    const distinctOrcids = [...new Set(matches.map(m => m.orcid))];
    if (distinctOrcids.length === 1) {
      await sql`UPDATE users SET orcid = ${distinctOrcids[0]} WHERE id = ${u.id}`;
      result.linked++;
    } else if (distinctOrcids.length > 1) {
      result.flagged.push({ userId: u.id, fullName: u.full_name, candidates: matches });
    } else {
      result.unmatched++;
    }
  }
  return result;
}

module.exports = { resolveOrcids, nameKey };
