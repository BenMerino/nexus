// Shared scope-narrowing for entity-backed stats readers (tags → entities).
// Returns a parameterized WHERE fragment over a `publications p` alias:
//   personal scope → p is one of the user's own papers (authorship by ORCID)
//   admin/tenant   → p belongs to the tenant
// This is the entity replacement for the legacy
//   `id IN (SELECT doi_record_id FROM tags WHERE category='author' AND ext_id=orcid)`
// filter that recurred across the stats/list readers. Callers using sql.query
// append their own params after f.params (offset by f.params.length).

const { isPersonalScope } = require("./scope");
const { normOrcid } = require("./entity-normalize");

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
  return { where: `p.tenant_id = $1`, params: [scope.tenantId] };
}

module.exports = { scopedPubFilter };
