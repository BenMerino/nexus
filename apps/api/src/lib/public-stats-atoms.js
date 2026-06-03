const { sql } = require("./sql");
const { listSourceIds } = require("./indexation-sources");

// Per-series DAILY atoms for the public "Publicaciones por año" stacked chart —
// mirrors Zincro's time-series atom architecture (OrderTimeSeriesLogic) so the
// chart is a real time-series (real ISO per bar) instead of a year-label
// category chart. The engine folds these daily atoms into year/month buckets at
// render time and, because every bar carries a real `iso`, the stacked-bar
// legend toggle animates as a UNIFORM drop (segments pair by date) rather than a
// left-to-right scan. One atom per DAY across the full span (zero days included).

const HOURS_PER_DAY = 24;

function daysBetween(aIso, bIso) {
  return Math.round((Date.parse(`${bIso}T00:00:00Z`) - Date.parse(`${aIso}T00:00:00Z`)) / 86_400_000);
}

// One row per (publication, day) carrying its venue's index flags. A paper counts
// toward each index its venue is flagged for, on its published day.
async function indexedByDay(tenantId) {
  const r = await sql`
    SELECT SUBSTRING(d.published FROM 1 FOR 10) AS iso,
           bool_or(v.in_wos) AS wos, bool_or(v.in_scopus) AS scopus,
           bool_or(v.in_doaj) AS doaj, bool_or(v.in_scielo) AS scielo
    FROM doi_records d
    LEFT JOIN published_in pi ON pi.publication_id = d.id
    LEFT JOIN venues v ON v.id = pi.venue_id AND v.tenant_id = ${tenantId}
    WHERE d.tenant_id = ${tenantId}
      AND d.published ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
    GROUP BY d.id, SUBSTRING(d.published FROM 1 FOR 10)`;
  return r.rows;
}

// Build the full-span daily atom array. Each atom: { key, iso, label, value, <Index>: n }.
// `present` is the subset of indexes that actually have data (matches the chart's
// presentIndexes so the legend shows only real series).
async function buildIndexationAtoms(tenantId) {
  const INDEXES = listSourceIds();
  const flagFor = { WoS: "wos", Scopus: "scopus", DOAJ: "doaj", SciELO: "scielo" };
  const rows = await indexedByDay(tenantId);
  if (!rows.length) return { atoms: [], series: [] };

  // Per-day, per-index counts.
  const byDay = new Map(); // iso -> { WoS: n, ... }
  const presentSet = new Set();
  let minIso = null;
  for (const row of rows) {
    if (!row.iso) continue;
    if (minIso === null || row.iso < minIso) minIso = row.iso;
    let bucket = byDay.get(row.iso);
    if (!bucket) { bucket = {}; byDay.set(row.iso, bucket); }
    for (const idx of INDEXES) {
      const col = flagFor[idx];
      if (!col || !row[col]) continue;
      bucket[idx] = (bucket[idx] || 0) + 1;
      presentSet.add(idx);
    }
  }
  const series = INDEXES.filter(k => presentSet.has(k));
  if (!series.length || minIso === null) return { atoms: [], series: [] };

  // SPARSE atoms (Zincro time-series contract): one atom per day WITH data, not
  // per calendar day. The engine's fold (bucket-sequence.ts) calendar-walks
  // between the first and last atom and synthesizes empty buckets itself, so
  // emitting empties only bloats the payload (utalca spans ~169y; dense was
  // ~62k atoms, 94% empty). key = hours-since-minIso keeps the first/last real
  // atoms anchoring the same span the dense stream did.
  const atoms = [...byDay.keys()].sort().map((iso) => {
    const day = byDay.get(iso);
    const atom = { key: daysBetween(minIso, iso) * HOURS_PER_DAY, iso, label: iso, value: 0 };
    let total = 0;
    for (const s of series) {
      const n = day[s] || 0;
      atom[s] = n;
      total += n;
    }
    atom.value = total;
    return atom;
  });
  return { atoms, series };
}

module.exports = { buildIndexationAtoms };
