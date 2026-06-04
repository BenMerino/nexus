const { sql } = require("./sql");
const { isPreprint } = require("./h-index");
const { resolvePubFilter } = require("./stats-scope");

// Data layer (N4) for the publication-CADENCE chart as a real time-series.
// "Cadence" is a methodologic interpretation of publication data — papers per
// period, broken down by work-type — NOT a stored entity. So there is no
// cadence table; it is derived ON READ from `doi_records` (published date +
// type), keeping the REAL date so the chart is a time-series (per-day atoms
// with type siblings) instead of a year-collapsed category chart. The engine
// folds the daily atoms to year buckets at render time and pairs stacked
// segments by date → the legend toggle drops uniformly.

const HOURS_PER_DAY = 24;

function daysBetween(aIso, bIso) {
  return Math.round((Date.parse(`${bIso}T00:00:00Z`) - Date.parse(`${aIso}T00:00:00Z`)) / 86_400_000);
}

// Per-(day, type) counts over the full span, real ISO dates. Preprints excluded
// (matching the legacy cadence methodology). Scope-narrowed via resolvePubFilter:
// a personal (researcher) scope counts only that author's papers; a public scope
// with a unitKey narrows to that faculty/department's authors; otherwise the
// whole tenant — one builder, scope flows through ctx (DGA scope model).
// Returns { atoms, series, meanPerYear }.
async function buildCadenceAtoms(scope) {
  const f = await resolvePubFilter(scope); // { where, params } over a `publications p` alias
  const r = await sql.query(
    `SELECT SUBSTRING(p.published FROM 1 FOR 10) AS iso,
            COALESCE(NULLIF(p.type, ''), 'unknown') AS type
     FROM publications p
     WHERE ${f.where} AND p.published ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'`,
    f.params);
  if (!r.rows.length) return { atoms: [], series: [], meanPerYear: 0 };

  // Collapse to the TOP work-types + an 'other' bucket. A tenant can carry 26+
  // CrossRef types, but the long tail is negligible (utalca: 20 types sum to
  // <1% of papers) — shipping every type means a 26-series stacked bar that's
  // both unreadable AND a ~5MB / 26-way fold (the "super slow" cadence). Top-N
  // + other mirrors composeTypeByYear's slice(0,6). Compute totals first.
  const TOP_TYPES = 6;
  const typeTotals = new Map();
  for (const row of r.rows) {
    if (!row.iso || isPreprint(row)) continue;
    typeTotals.set(row.type, (typeTotals.get(row.type) || 0) + 1);
  }
  const topTypes = new Set(
    [...typeTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, TOP_TYPES).map(([t]) => t),
  );
  const hasOther = typeTotals.size > topTypes.size;
  const bucketType = (t) => (topTypes.has(t) ? t : "other");

  const byDay = new Map(); // iso -> { type: n }
  const typesSeen = new Set();
  let minIso = null;
  for (const row of r.rows) {
    if (!row.iso || isPreprint(row)) continue;
    if (minIso === null || row.iso < minIso) minIso = row.iso;
    const type = bucketType(row.type);
    let d = byDay.get(row.iso);
    if (!d) { d = {}; byDay.set(row.iso, d); }
    d[type] = (d[type] || 0) + 1;
    typesSeen.add(type);
  }
  if (minIso === null) return { atoms: [], series: [], meanPerYear: 0 };
  // Top types sorted by total (desc), then 'other' last so it stacks at the top.
  const series = [...topTypes].sort((a, b) => (typeTotals.get(b) || 0) - (typeTotals.get(a) || 0));
  if (hasOther && typesSeen.has("other")) series.push("other");

  // SPARSE atoms (Zincro time-series contract): one atom per day WITH data,
  // not per calendar day. The engine's fold (bucket-sequence.ts) calendar-walks
  // between the first and last atom and synthesizes the empty buckets itself —
  // so pre-materializing empties only bloats the payload (utalca spans ~169y;
  // dense was ~62k atoms, 84% empty). key = hours-since-minIso keeps the first/
  // last real atoms anchoring the same span the dense stream did.
  const atoms = [...byDay.keys()].sort().map((iso) => {
    const day = byDay.get(iso);
    const atom = { key: daysBetween(minIso, iso) * HOURS_PER_DAY, iso, label: iso, value: 0 };
    let t = 0;
    for (const s of series) { const n = day[s] || 0; atom[s] = n; t += n; }
    atom.value = t;
    return atom;
  });
  // Mean per year — over the RECENT window (last MEAN_WINDOW_YEARS), matching the
  // canonical cadence methodology (portfolio-aggregates.buildCadence: total in
  // window / window). A full-span mean would divide by ~169 years of mostly-empty
  // history and read far too low (and disagree with the headline figure).
  const MEAN_WINDOW_YEARS = 8;
  const currentYear = new Date().getUTCFullYear();
  const startYear = currentYear - MEAN_WINDOW_YEARS + 1;
  let windowTotal = 0;
  for (const a of atoms) {
    const y = parseInt(a.iso.slice(0, 4), 10);
    if (y >= startYear && y <= currentYear) windowTotal += a.value;
  }
  const meanPerYear = Math.round((windowTotal / MEAN_WINDOW_YEARS) * 10) / 10;
  return { atoms, series, meanPerYear };
}

module.exports = { buildCadenceAtoms };
