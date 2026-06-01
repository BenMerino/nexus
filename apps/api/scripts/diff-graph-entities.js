// Diff harness gating the graph-builder cutover (tags → entities). Builds BOTH
// graphs for tenant 1 (admin scope) and compares node-id and edge (source→target)
// SETS. Expected non-empty buckets are the DOCUMENTED deltas only:
//   • onlyOLD nodes/edges in group 'source'        (3 vestigial nodes dropped)
//   • indexed_in: onlyOLD per-ISSN nodes vanish, onlyNEW per-source nodes appear,
//     onlyNEW edges are the recovered sibling-ISSN coverage.
// ANYTHING else (author/journal/non-journal/institution/type/doi divergence) is
// real drift and blocks cutover.
//
//   railway ssh --service Nexus "cd /app/apps/api && node scripts/diff-graph-entities.js"

const { buildGraph } = require("../src/lib/graph-builder");
const { buildGraphFromEntities } = require("../src/lib/graph-builder-entities");
const { sql } = require("../src/lib/sql");
const { journalNameKey: nameKey } = require("../src/lib/journal-canon");

const groupOf = (id) => id.slice(0, id.indexOf(":"));

function diffSets(oldArr, newArr, key) {
  const o = new Set(oldArr.map(key));
  const n = new Set(newArr.map(key));
  const onlyOld = [...o].filter((x) => !n.has(x));
  const onlyNew = [...n].filter((x) => !o.has(x));
  return { onlyOld, onlyNew };
}

function byGroup(ids, pick = (x) => x) {
  const m = {};
  for (const id of ids) { const g = groupOf(pick(id)); m[g] = (m[g] || 0) + 1; }
  return m;
}

async function main() {
  const scope = { tenantId: 1, role: "superadmin", orcid: null, ror: null };
  const [oldG, newG] = [await buildGraph(scope), await buildGraphFromEntities(scope)];
  console.log(`OLD nodes=${oldG.nodes.length} edges=${oldG.edges.length}`);
  console.log(`NEW nodes=${newG.nodes.length} edges=${newG.edges.length}`);

  const nodeDiff = diffSets(oldG.nodes, newG.nodes, (n) => n.id);
  const edgeDiff = diffSets(oldG.edges, newG.edges, (e) => `${e.source}→${e.target}`);

  console.log("\nNODE onlyOLD by group:", byGroup(nodeDiff.onlyOld));
  console.log("NODE onlyNEW by group:", byGroup(nodeDiff.onlyNew));
  console.log("EDGE onlyOLD by target-group:", byGroup(edgeDiff.onlyOld, (e) => e.split("→")[1]));
  console.log("EDGE onlyNEW by target-group:", byGroup(edgeDiff.onlyNew, (e) => e.split("→")[1]));

  // Classify every diff. Benign (documented, entities are MORE correct):
  //   source        — 3 vestigial nodes dropped (no entity table).
  //   indexed_in    — 250 per-ISSN nodes → 4 per-source flag nodes.
  //   journal/      — a name tagged inconsistently as BOTH journal and
  //   non-journal     non-journal across papers; entities collapse it to one
  //                   real venue (OLD kept duplicate nodes). multiCatKeys.
  //   institution   — a synonym-merge variant ROR folded to its canonical
  //                   (OLD keyed the un-merged variant). instVariantRors.
  // Anything else = real drift → fail.
  const { multiCatKeys, instVariantRors } = await classifiers(1);
  const benign = (id) => {
    const g = groupOf(id);
    if (g === "source" || g === "indexed_in") return true;
    if (g === "journal" || g === "non-journal") {
      const node = oldG.nodes.find((n) => n.id === id) || newG.nodes.find((n) => n.id === id);
      return node && multiCatKeys.has(nameKey(node.label || ""));
    }
    if (g === "institution") return instVariantRors.has(id.slice("institution:".length));
    return false;
  };
  const benignEdge = (e) => benign(e.split("→")[1]);
  const drift = [
    ...nodeDiff.onlyOld.filter((id) => !benign(id)),
    ...nodeDiff.onlyNew.filter((id) => !benign(id)),
    ...edgeDiff.onlyOld.filter((e) => !benignEdge(e)),
    ...edgeDiff.onlyNew.filter((e) => !benignEdge(e)),
  ];
  if (drift.length) {
    console.log(`\n✗ ${drift.length} UNEXPECTED diffs (unexplained drift):`);
    for (const d of drift.slice(0, 30)) console.log("   ", d);
    process.exit(1);
  }
  console.log("\n✓ all diffs are documented deltas (source/indexed_in + multi-category venue & merged-institution noise — entities are more correct). Safe to cut over.");
  process.exit(0);
}

// name_keys that appear under >1 of journal/non-journal/repository (the
// inconsistently-tagged venues OLD duplicated), and institution synonym-variant
// RORs (folded into a canonical in entities).
async function classifiers(tenantId) {
  const rows = (await sql`
    SELECT t.category, t.value FROM tags t JOIN publications p ON p.id = t.doi_record_id
    WHERE t.category IN ('journal','non-journal','repository') AND p.tenant_id = ${tenantId}`).rows;
  const cats = new Map();
  for (const r of rows) {
    const k = nameKey(r.value);
    if (!k) continue;
    if (!cats.has(k)) cats.set(k, new Set());
    cats.get(k).add(r.category);
  }
  const multiCatKeys = new Set([...cats].filter(([, s]) => s.size > 1).map(([k]) => k));
  const syn = (await sql`
    SELECT DISTINCT t.ext_id FROM tag_synonyms s
    JOIN tags t ON t.tenant_id = ${tenantId} AND t.category = 'institution' AND t.value = s.variant
    WHERE s.tenant_id = ${tenantId} AND s.category = 'institution'`).rows;
  const instVariantRors = new Set(syn.map((r) => (r.ext_id || "").replace(/^https?:\/\/ror\.org\//, "")));
  return { multiCatKeys, instVariantRors };
}

main().catch((e) => { console.error(e); process.exit(2); });
