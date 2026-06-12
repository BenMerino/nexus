const { sql } = require("./sql");
const { resolvePubFilter } = require("./stats-scope");

// Per-year series for the public KPI cards' sparklines — the METHODOLOGIC
// interpretation behind each headline figure (a real trend, not a glyph). All
// three narrow with scope via resolvePubFilter (a unitKey → one faculty's
// authors), so the sparklines re-scope exactly like the KPI numbers above them.
// Each point carries a `status`: 'observed' (full year, solid), 'partial' (the
// current still-filling year, dashed) or 'projected' (regression forecast,
// dashed) — mirroring the citation-velocity panel's projection behavior so the
// glyph dashes its tail and continues the gradient underneath.
// Returns { publications:[{year,value,status}], citations:[…], authors:[…] }.

const FORECAST_YEARS = 3;     // how many years to project past the last observed
const FIT_WINDOW = 6;         // recent observed years the regression fits over

// Least-squares slope/intercept over [{x,y}]. Flat line if x has no spread.
function regression(pts) {
  const n = pts.length;
  if (n < 2) return { slope: 0, intercept: pts[0] ? pts[0].y : 0 };
  const mx = pts.reduce((s, p) => s + p.x, 0) / n;
  const my = pts.reduce((s, p) => s + p.y, 0) / n;
  let num = 0, den = 0;
  for (const p of pts) { num += (p.x - mx) * (p.y - my); den += (p.x - mx) ** 2; }
  const slope = den === 0 ? 0 : num / den;
  return { slope, intercept: my - slope * mx };
}

// Stamp status onto a raw [{year,value}] series (ascending) and append a short
// regression forecast. The last year is 'partial' (still filling); the rest are
// 'observed'; the forecast tail is 'projected'. Projecting needs ≥3 observed
// points — below that, return the raw series unprojected (all observed).
function withProjection(rows, currentYear) {
  if (!rows.length) return [];
  const out = rows.map((r, i) => ({
    year: r.year, value: r.value,
    status: (i === rows.length - 1 && r.year >= currentYear) ? "partial" : "observed",
  }));
  const observed = out.filter((p) => p.status === "observed");
  if (observed.length < 3) return out;
  const fit = observed.slice(-FIT_WINDOW).map((p) => ({ x: p.year, y: p.value }));
  const { slope, intercept } = regression(fit);
  const lastYear = out[out.length - 1].year;
  for (let i = 1; i <= FORECAST_YEARS; i++) {
    const y = lastYear + i;
    out.push({ year: y, value: Math.max(0, Math.round(slope * y + intercept)), status: "projected" });
  }
  return out;
}

// Publications per published-year (full span). Alias `p` for the filter.
async function pubsByYear(scope) {
  const f = await resolvePubFilter(scope);
  const r = await sql.query(
    `SELECT SUBSTRING(p.published FROM 1 FOR 4) AS year, COUNT(*)::int AS value
     FROM publications p
     WHERE ${f.where} AND p.published ~ '^[0-9]{4}'
     GROUP BY 1 ORDER BY 1`, f.params);
  return r.rows.map((row) => ({ year: Number(row.year), value: row.value }));
}

// Citations received per year (the same table velocity reads), full span.
async function citesByYear(scope) {
  const f = await resolvePubFilter(scope);
  const r = await sql.query(
    `SELECT c.year, SUM(c.count)::int AS value
     FROM doi_citations_by_year c
     JOIN publications p ON p.id = c.doi_record_id
     WHERE ${f.where}
     GROUP BY c.year ORDER BY c.year`, f.params);
  return r.rows.map((row) => ({ year: Number(row.year), value: row.value }));
}

// Distinct authors with at least one paper published each year — the
// "researchers active per year" trend behind the Authors KPI.
async function authorsByYear(scope) {
  const f = await resolvePubFilter(scope);
  const r = await sql.query(
    `SELECT SUBSTRING(p.published FROM 1 FOR 4) AS year,
            COUNT(DISTINCT s.author_id)::int AS value
     FROM publications p
     JOIN authorship s ON s.publication_id = p.id
     WHERE ${f.where} AND p.published ~ '^[0-9]{4}'
     GROUP BY 1 ORDER BY 1`, f.params);
  return r.rows.map((row) => ({ year: Number(row.year), value: row.value }));
}

// %OA per published-year — the trend behind the Open Access card. A RATIO, so
// no regression tail is appended (a projected percentage can escape [0,100])
// and the still-filling current year is 'partial' (OA flags lag indexing, so
// its ratio reads low, not just incomplete). Windowed to the last 30 years:
// OA is a digital-era phenomenon, and historic years with a handful of
// retro-digitized papers plot as 50-100% spikes (small-denominator noise,
// not a trend). HAVING ≥5 guards thin years inside the window too.
const OA_WINDOW_YEARS = 30;
async function oaByYear(scope, currentYear) {
  const f = await resolvePubFilter(scope);
  const minYear = String(currentYear - OA_WINDOW_YEARS);
  const r = await sql.query(
    `SELECT SUBSTRING(p.published FROM 1 FOR 4) AS year,
            ROUND(100.0 * COUNT(*) FILTER (WHERE p.open_access) / COUNT(*), 1)::float AS value
     FROM publications p
     WHERE ${f.where} AND p.published ~ '^[0-9]{4}'
       AND SUBSTRING(p.published FROM 1 FOR 4) >= $${f.params.length + 1}
     GROUP BY 1 HAVING COUNT(*) >= 5 ORDER BY 1`, [...f.params, minYear]);
  return r.rows.map((row) => ({ year: Number(row.year), value: Number(row.value) }));
}

// Status stamp without a forecast (for ratio series): last year partial.
const stampPartial = (rows, currentYear) => rows.map((r, i) => ({
  ...r, status: (i === rows.length - 1 && r.year >= currentYear) ? "partial" : "observed",
}));

async function buildKpiSparks(scope) {
  const currentYear = new Date().getUTCFullYear();
  const [publications, citations, authors, oa] = await Promise.all([
    pubsByYear(scope), citesByYear(scope), authorsByYear(scope), oaByYear(scope, currentYear),
  ]);
  return {
    publications: withProjection(publications, currentYear),
    citations: withProjection(citations, currentYear),
    authors: withProjection(authors, currentYear),
    oa: stampPartial(oa, currentYear),
  };
}

module.exports = { buildKpiSparks, citesByYear, withProjection };
