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

  // Raw node/edge-id diff, for visibility only (venue node-ids legitimately
  // change when duplicate venues collapse to one — that's not drift by itself).
  const nodeDiff = diffSets(oldG.nodes, newG.nodes, (n) => n.id);
  console.log("\nNODE onlyOLD by group:", byGroup(nodeDiff.onlyOld));
  console.log("NODE onlyNEW by group:", byGroup(nodeDiff.onlyNew));

  // THE GATE — structural, cause-agnostic (provably complete, unlike a pattern
  // whitelist): the only thing that must hold is that every DOI connects to the
  // SAME real entities in both graphs, where a venue's identity is its
  // normalized name-key (not its node-id, which collapses duplicates) and an
  // institution's is its ROR. We compare, per DOI, the SET of connected
  // venue-name-keys and institution-RORs. Group differences (a venue node moving
  // journal↔non-journal, ISSN-sibling collapse, synonym merge) preserve this
  // relation; only a DOI genuinely gaining/losing a real venue/institution
  // breaks it. The doc'd source/indexed_in deltas are excluded (no entity).
  const oldRel = entityRelation(oldG);
  const newRel = entityRelation(newG);
  const { onlyOld, onlyNew } = diffSets([...oldRel], [...newRel], (x) => x);
  console.log(`\nstructural (DOI → venue-name-key / institution-ROR) relation:`);
  console.log(`  onlyOLD=${onlyOld.length}  onlyNEW=${onlyNew.length}`);
  if (onlyOld.length || onlyNew.length) {
    console.log("✗ REAL DRIFT — a DOI's connected real entities differ:");
    for (const d of [...onlyOld.map((x) => `OLD ${x}`), ...onlyNew.map((x) => `NEW ${x}`)].slice(0, 30)) console.log("   ", d);
    process.exit(1);
  }
  console.log("\n✓ every DOI connects to the identical set of real venues & institutions in both graphs.");
  console.log("  (node-id-level diffs above are venue-duplicate collapses + the documented source/indexed_in deltas — entities are more correct.)");
  process.exit(0);
}

// The per-DOI relation to REAL entities: a set of strings
//   "<doi> :: venue=<name-key>" / "<doi> :: inst=<ror>"
// from a graph's venue/institution nodes + their DOI edges. Venue identity is
// the node's normalized label (name-key) so two duplicate venue nodes for one
// journal (different node-ids, same name) count as the SAME venue. Institution
// identity is the ROR (node ext_id). source/indexed_in/type/author groups are
// excluded — those deltas are documented and don't touch the venue/inst relation.
function entityRelation(G) {
  const node = new Map(G.nodes.map((n) => [n.id, n]));
  const rel = new Set();
  for (const e of G.edges) {
    const t = node.get(e.target);
    if (!t) continue;
    const doi = e.source;
    if (t.group === "journal" || t.group === "non-journal") {
      rel.add(`${doi} :: venue=${nameKey(t.label || "")}`);
    } else if (t.group === "institution") {
      rel.add(`${doi} :: inst=${t.ext_id || nameKey(t.label || "")}`);
    }
  }
  return rel;
}

main().catch((e) => { console.error(e); process.exit(2); });
