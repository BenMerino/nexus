// Shared scope-narrowing for entity-backed stats readers (tags → entities).
// Returns a parameterized WHERE fragment over a `publications p` alias:
//   personal scope → p is one of the user's own papers (authorship by ORCID)
//   admin/tenant   → p belongs to the tenant
// This is the entity replacement for the legacy
//   `id IN (SELECT doi_record_id FROM tags WHERE category='author' AND ext_id=orcid)`
// filter that recurred across the stats/list readers. Callers using sql.query
// append their own params after f.params (offset by f.params.length).

const { isPersonalScope } = require("./scope");
const { normOrcid, normRor } = require("./entity-normalize");
const { unitPubFilter, unitOrcids, rosterFacultyByOrcid } = require("./stats-unit-scope");

function scopedPubFilter(scope) {
  if (isPersonalScope(scope)) {
    // $1 = bare ORCID, $2 = tenantId. Narrow to publications the user authored.
    return {
      where: `p.id IN (
        SELECT s.publication_id FROM authorship s JOIN authors a ON a.id = s.author_id
        WHERE a.orcid = $1 AND a.tenant_id = $2)`,
      params: [normOrcid(scope.orcid), scope.tenantId],
    };
  }
  // Public scope (the tenant's PUBLIC URL) shows only data attributable to the
  // tenant's institution: a publication counts iff it carries an affiliated_with
  // edge to an institution whose ROR is the tenant's own. This excludes papers a
  // researcher published while at a PRIOR institution (ingested by ORCID-roster
  // but never UTalca-affiliated) — the DGA rule "the public URL gives only data
  // attributable to the ROR". Admin scope (below) still sees the whole tenant
  // corpus. The ROR must be present in scope (handler/composer resolves it); if
  // it's absent we fall through to tenant-wide rather than hide everything.
  const ror = scope && scope.role === "public" ? normRor(scope.ror) : null;
  if (ror) {
    return {
      where: `p.tenant_id = $1 AND EXISTS (
        SELECT 1 FROM affiliated_with aw JOIN institutions i ON i.id = aw.institution_id
        WHERE aw.publication_id = p.id AND i.tenant_id = $1 AND i.ror = $2)`,
      params: [scope.tenantId, ror],
    };
  }
  return { where: `p.tenant_id = $1`, params: [scope.tenantId] };
}

// Personal-scope "papers I authored" filter as a SQL fragment for an arbitrary
// id column, with param placeholders starting at `startIdx`. For readers that
// build positional SQL by hand (db-list pagination, some handlers) — the entity
// replacement for `<idCol> IN (SELECT doi_record_id FROM tags WHERE category='author' AND ext_id=$n)`.
function personalPaperFilter(idCol, orcid, tenantId, startIdx) {
  return {
    sql: `${idCol} IN (
      SELECT s.publication_id FROM authorship s JOIN authors a ON a.id = s.author_id
      WHERE a.orcid = $${startIdx} AND a.tenant_id = $${startIdx + 1})`,
    params: [normOrcid(orcid), tenantId],
  };
}

// Async filter resolver the stats readers use: when scope.unitKey is present
// it narrows to that org unit (async — needs a roster lookup); otherwise it
// returns the plain sync scopedPubFilter result. A unitKey that resolves to no
// unit falls back to the tenant filter (an empty result would be misleading;
// the caller validated tenant membership of the key upstream). Personal scope
// is never combined with a unit (units are a tenant/public view), so unitKey
// takes precedence only for non-personal scope.
async function resolvePubFilter(scope) {
  if (scope && scope.unitKey && !isPersonalScope(scope)) {
    const u = await unitPubFilter(scope.unitKey, scope.tenantId);
    if (u) return u;
  }
  return scopedPubFilter(scope);
}

// unitPubFilter + unitOrcids + rosterFacultyByOrcid now live in
// stats-unit-scope.js (N5); re-exported here so existing
// `require("./stats-scope")` callers keep their import path.
module.exports = { scopedPubFilter, personalPaperFilter, unitPubFilter, resolvePubFilter, unitOrcids, rosterFacultyByOrcid };
