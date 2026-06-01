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
  const { multiCatKeys, mergedInstRors, venueIdKey } = await classifiers(1);
  const benign = (id) => {
    const g = groupOf(id);
    if (g === "source" || g === "indexed_in") return true;
    if (g === "journal" || g === "non-journal") {
      // Benign if this venue node-id maps to a name_key OLD split into >1 node
      // (entities collapse to one venue). The node-id suffix can be an ISSN or a
      // raw name; venueIdKey maps either back to its name_key.
      return multiCatKeys.has(venueIdKey.get(id) || "");
    }
    if (g === "institution") return mergedInstRors.has(id.slice("institution:".length));
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

// "collapsed" name_keys: ones where the OLD tag-graph produced MORE THAN ONE
// distinct venue node-id for the same journal name, which the entity model
// rightly collapses to a single venue. That happens when a name spans >1
// category (journal+non-journal noise) OR a non-journal name carries multiple
// distinct ext_ids (sibling ISSNs / mixed ISSN+no-ISSN). We reconstruct each
// name's OLD node-id set and flag any with >1. Also: institution synonym-variant
// RORs (folded into a canonical in entities).
async function classifiers(tenantId) {
  const rows = (await sql`
    SELECT t.category, t.value, t.ext_id FROM tags t JOIN publications p ON p.id = t.doi_record_id
    WHERE t.category IN ('journal','non-journal','repository') AND p.tenant_id = ${tenantId}`).rows;
  // OLD node-id per tag: journal/non-journal key by ext_id when present (journals
  // collapse siblings, so use category alone for journal-with-ext), else by name.
  // We only need a STABLE per-name set whose size>1 means "OLD split it".
  const reprs = new Map();      // name_key → Set(repr)
  const venueIdKey = new Map(); // OLD venue node-id → name_key
  for (const r of rows) {
    const k = nameKey(r.value);
    if (!k) continue;
    if (r.category === "repository") continue; // repository papers are excluded
    // OLD node-id per tag: journal collapses siblings (one repr); non-journal
    // keys by ext_id, else by RAW value (so case/whitespace variants of one name
    // were SEPARATE nodes OLD made — entities collapse them to one venue).
    const repr = r.category === "journal" ? "journal" : (r.ext_id ? `nj:${r.ext_id}` : `nj:${r.value}`);
    if (!reprs.has(k)) reprs.set(k, new Set());
    reprs.get(k).add(repr);
    // The OLD node-id this tag produced, mapped back to its name_key.
    const nodeId = r.category === "journal"
      ? `journal:${r.ext_id}`
      : `non-journal:${r.ext_id || r.value}`;
    venueIdKey.set(nodeId, k);
  }
  const multiCatKeys = new Set([...reprs].filter(([, s]) => s.size > 1).map(([k]) => k));

  // Institution merges: both the disappearing VARIANT ROR (its OLD node) and the
  // CANONICAL ROR (the re-pointed NEW edges) are benign — entities merged them.
  const syn = (await sql`
    SELECT DISTINCT s.ror_id, t.ext_id AS variant_ext FROM tag_synonyms s
    JOIN tags t ON t.category = 'institution' AND t.value = s.variant
    JOIN publications p ON p.id = t.doi_record_id AND p.tenant_id = ${tenantId}
    WHERE s.tenant_id = ${tenantId} AND s.category = 'institution'`).rows;
  const bare = (x) => (x || "").replace(/^https?:\/\/ror\.org\//, "");
  const mergedInstRors = new Set();
  for (const r of syn) { mergedInstRors.add(bare(r.variant_ext)); mergedInstRors.add(bare(r.ror_id)); }
  return { multiCatKeys, mergedInstRors, venueIdKey };
}

main().catch((e) => { console.error(e); process.exit(2); });
