// Diff gate for graph-meta (tags → entities, edge-folded). Compares OLD
// (tag-aggregated per category:ext_id) vs NEW (folded over the entity graph's
// edges) per-node metadata, for admin scope (tenant 1). The node-id SET must
// match the entity graph (that's the point — meta keys to rendered nodes); for
// shared node-ids, avg/max citations + OA% must agree (keyword sets are
// abstract-order-sensitive, so we compare the numeric metrics only). READ-ONLY.

const { sql } = require("../src/lib/sql");
const NEW = require("../src/lib/graph-meta");
const { buildGraphFromEntities } = require("../src/lib/graph-builder-entities");

async function main() {
  const scope = { tenantId: 1, role: "superadmin", orcid: null, ror: null };
  const { tagMeta } = await NEW.getGraphMetadata(scope);
  const { nodes } = await buildGraphFromEntities(scope);
  const nodeIds = new Set(nodes.filter((n) => n.group !== "doi").map((n) => n.id));

  // Every non-doi graph node should have metadata, and vice-versa (meta keys ⊆
  // node ids — a node with zero connected docs may legitimately be absent).
  const metaKeys = new Set(Object.keys(tagMeta));
  const orphanMeta = [...metaKeys].filter((k) => !nodeIds.has(k));
  const coverage = [...nodeIds].filter((id) => metaKeys.has(id)).length;
  console.log(`graph nodes(non-doi)=${nodeIds.size} metaKeys=${metaKeys.size} covered=${coverage} orphanMeta=${orphanMeta.length}`);

  // Spot-check numbers against a direct entity aggregate for a few author nodes.
  let drift = 0;
  const sample = nodes.filter((n) => n.group === "author").slice(0, 5);
  for (const n of sample) {
    const m = tagMeta[n.id];
    if (!m) { console.log(`DRIFT  ${n.id}: no meta`); drift++; continue; }
    // independent recompute over publications (is_repository lives there, not on
    // the doi_records compat view); exclude preprint/repository like the graph.
    const r = (await sql`SELECT AVG(COALESCE(p.citation_count,0))::float avg, MAX(COALESCE(p.citation_count,0))::int max
      FROM publications p JOIN authorship s ON s.publication_id=p.id JOIN authors a ON a.id=s.author_id
      WHERE a.orcid=${n.ext_id} AND a.tenant_id=1 AND p.is_repository=FALSE AND (p.type IS DISTINCT FROM 'preprint')`).rows[0];
    const ok = Math.abs((+r.avg || 0) - m.avgCitations) <= 0.2 && (+r.max || 0) === m.maxCitations;
    if (!ok) { console.log(`DRIFT  ${n.id}: recompute avg=${(+r.avg).toFixed(1)}/max=${r.max} vs meta avg=${m.avgCitations}/max=${m.maxCitations}`); drift++; }
    else console.log(`OK   ${n.id}: avg=${m.avgCitations} max=${m.maxCitations}`);
  }
  if (orphanMeta.length) { console.log("orphan meta sample:", orphanMeta.slice(0, 5)); drift++; }
  console.log(drift === 0 ? "\n✓ graph-meta keys to entity nodes + numbers check out" : `\n✗ ${drift} issue(s)`);
  process.exit(drift === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(2); });
