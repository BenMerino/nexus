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

  // Drift = any divergence outside the two sanctioned groups.
  const allowed = new Set(["source", "indexed_in"]);
  const drift = [
    ...nodeDiff.onlyOld.filter((id) => !allowed.has(groupOf(id))),
    ...nodeDiff.onlyNew.filter((id) => !allowed.has(groupOf(id))),
    ...edgeDiff.onlyOld.filter((e) => !allowed.has(groupOf(e.split("→")[1]))),
    ...edgeDiff.onlyNew.filter((e) => !allowed.has(groupOf(e.split("→")[1]))),
  ];
  if (drift.length) {
    console.log(`\n✗ ${drift.length} UNEXPECTED diffs (outside source/indexed_in):`);
    for (const d of drift.slice(0, 30)) console.log("   ", d);
    process.exit(1);
  }
  console.log("\n✓ only documented deltas (source dropped, indexed_in per-ISSN→per-source). Safe to cut over.");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(2); });
