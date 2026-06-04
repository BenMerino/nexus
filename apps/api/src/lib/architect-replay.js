const { sql } = require("./sql");

// Atom-based replay backend for the newer graph-engine.
//
// The engine drives interactive charts (time slider, fold-to-day/week/month)
// from "atoms" — one finest-grain datum carrying a real `iso` date. This module
// supplies the two services the engine needs, dispatched by `kind`:
//   - timelineSpan(tenantId, kind) -> { earliest, today, totalDays }   (slider track)
//   - recompose(query)             -> GraphDirective with atoms          (slider/toggle re-fetch)
//
// Verified: doi_records.published is full YYYY-MM-DD for ~100% of rows, so
// day-resolution atoms are honest (no synthetic dates).

function unknownKind(kind) {
  const e = new Error(`Unknown chart kind: ${kind}`);
  e.code = "UNKNOWN_KIND";
  return e;
}

// Each kind names the date column + tenant-scoped row source. Only the
// publications timeline today; add kinds here as charts gain replay.
const KINDS = {
  publications: {
    // one row per published paper for the tenant, with a clean ISO date
    rowsSql: (tenantId) => sql`
      SELECT SUBSTRING(published FROM 1 FOR 10) AS iso
      FROM doi_records
      WHERE tenant_id = ${tenantId}
        AND published ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'`,
  },
};

function todayIso() {
  return new Date().toISOString().split("T")[0];
}

function daysBetween(aIso, bIso) {
  const a = Date.parse(`${aIso}T00:00:00Z`);
  const b = Date.parse(`${bIso}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

// Slider track: earliest record → today.
// Kinds whose slider track is the tenant's publication timeline. The span is
// the same MIN(published)→today range for all of them (cadence/byIndex fold the
// SAME doi_records dates, just grouped differently), so they share one span
// lookup. Without this the slider's span fetch threw unknownKind for the
// replayable cadence/byIndex charts → span=null → slider never rendered.
const PUBLICATION_TIMELINE_KINDS = new Set([
  "publications", "publications.cadence", "publications.byIndex",
]);

async function timelineSpan(tenantId, kind) {
  if (!KINDS[kind] && !PUBLICATION_TIMELINE_KINDS.has(kind)) throw unknownKind(kind);
  const { rows } = await sql`
    SELECT MIN(SUBSTRING(published FROM 1 FOR 10)) AS earliest
    FROM doi_records
    WHERE tenant_id = ${tenantId}
      AND published ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'`;
  const today = todayIso();
  const earliest = rows[0]?.earliest || today;
  return { earliest, today, totalDays: daysBetween(earliest, today) + 1 };
}

// Build day-resolution atoms for the publications timeline, filtered to the
// query window. One atom per day that has >=1 publication; key = epoch-day
// index from `earliest`, iso = that day, value = count. The client folds these
// into day/week/month/year buckets at render time via aggregator 'sum'.
async function buildPublicationAtoms(tenantId, query, span) {
  const windowDays = query.windowDays ?? null;
  const asOf = query.asOf || span.today;
  // half-open [start, end+1d): end is asOf; start is asOf-windowDays, or genesis
  const start = windowDays == null
    ? span.earliest
    : isoMinusDays(asOf, windowDays);

  const { rows } = await sql`
    SELECT SUBSTRING(published FROM 1 FOR 10) AS iso, COUNT(*)::int AS n
    FROM doi_records
    WHERE tenant_id = ${tenantId}
      AND published ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
      AND SUBSTRING(published FROM 1 FOR 10) >= ${start}
      AND SUBSTRING(published FROM 1 FOR 10) <= ${asOf}
    GROUP BY 1 ORDER BY 1`;

  // key is HOURS-since-anchor (engine contract, fold-atoms.ts): daily atoms
  // sit at hour 0 of their day → key = dayIndex * 24. Using day index alone
  // makes the engine's `(lastKey-firstKey+1)/24` span math 24x too small,
  // which mis-scales the slider geometry (offset pointer) and breaks folding.
  const HOURS_PER_DAY = 24;
  return rows.map((r) => ({
    key: daysBetween(span.earliest, r.iso) * HOURS_PER_DAY,
    label: r.iso,
    iso: r.iso,
    value: r.n,
  }));
}

function isoMinusDays(iso, days) {
  const t = Date.parse(`${iso}T00:00:00Z`) - days * 86_400_000;
  return new Date(t).toISOString().split("T")[0];
}

// recompose: given a mutated GraphQuery (kind + tenantId + window/asOf/foldUnit),
// return a fresh GraphDirective with atoms. Dispatches by kind.
async function recompose(query) {
  const tenantId = parseInt(query.tenantId, 10);
  const kind = query.kind;
  if (!KINDS[kind]) throw unknownKind(kind);

  const span = await timelineSpan(tenantId, kind);
  const atoms = await buildPublicationAtoms(tenantId, query, span);
  return {
    type: "bar",
    title: "Publications by Year",
    xLabel: "Date",
    yLabel: "Articles",
    aggregator: "sum",
    atoms,
    data: [], // atoms are the source of truth; renderer ignores data
    query: { ...query, tenantId: String(tenantId), kind },
  };
}

module.exports = { timelineSpan, recompose, buildPublicationAtoms, KINDS, unknownKind, todayIso, daysBetween };
