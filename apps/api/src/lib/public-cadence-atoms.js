const { sql } = require("./sql");
const { isPreprint } = require("./h-index");
const { scopedPubFilter } = require("./stats-scope");

// Data layer (N4) for the publication-CADENCE chart as a real time-series.
// "Cadence" is a methodologic interpretation of publication data — papers per
// period, broken down by work-type — NOT a stored entity. So there is no
// cadence table; it is derived ON READ from `doi_records` (published date +
// type), keeping the REAL date so the chart is a time-series (per-day atoms
// with type siblings) instead of a year-collapsed category chart. The engine
// folds the daily atoms to year buckets at render time and pairs stacked
// segments by date → the legend toggle drops uniformly.

const HOURS_PER_DAY = 24;

function todayIso() {
  return new Date().toISOString().split("T")[0];
}
function daysBetween(aIso, bIso) {
  return Math.round((Date.parse(`${bIso}T00:00:00Z`) - Date.parse(`${aIso}T00:00:00Z`)) / 86_400_000);
}
function addDaysIso(iso, n) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().split("T")[0];
}

// Per-(day, type) counts over the full span, real ISO dates. Preprints excluded
// (matching the legacy cadence methodology). Scope-narrowed via scopedPubFilter:
// a personal (researcher) scope counts only that author's papers, an admin/public
// scope the whole tenant — one builder, scope flows through ctx (DGA scope model).
// Returns { atoms, series, meanPerYear }.
async function buildCadenceAtoms(scope) {
  const f = scopedPubFilter(scope); // { where, params } over a `publications p` alias
  const r = await sql.query(
    `SELECT SUBSTRING(p.published FROM 1 FOR 10) AS iso,
            COALESCE(NULLIF(p.type, ''), 'unknown') AS type
     FROM publications p
     WHERE ${f.where} AND p.published ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'`,
    f.params);
  if (!r.rows.length) return { atoms: [], series: [], meanPerYear: 0 };

  const byDay = new Map(); // iso -> { type: n }
  const typesSeen = new Set();
  let minIso = null;
  for (const row of r.rows) {
    if (!row.iso || isPreprint(row)) continue;
    if (minIso === null || row.iso < minIso) minIso = row.iso;
    let d = byDay.get(row.iso);
    if (!d) { d = {}; byDay.set(row.iso, d); }
    d[row.type] = (d[row.type] || 0) + 1;
    typesSeen.add(row.type);
  }
  if (minIso === null) return { atoms: [], series: [], meanPerYear: 0 };
  const series = [...typesSeen].sort();

  const today = todayIso();
  const span = daysBetween(minIso, today);
  const atoms = [];
  for (let i = 0; i <= span; i++) {
    const iso = addDaysIso(minIso, i);
    const day = byDay.get(iso);
    const atom = { key: i * HOURS_PER_DAY, iso, label: iso, value: 0 };
    let t = 0;
    for (const s of series) { const n = day ? (day[s] || 0) : 0; atom[s] = n; t += n; }
    atom.value = t;
    atoms.push(atom);
  }
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
