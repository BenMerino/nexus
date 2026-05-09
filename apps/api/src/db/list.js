// Canonical paginated-list helper. The single SQL entry point for every
// "list" endpoint that needs pagination — handlers never write raw
// LIMIT/OFFSET themselves, so the contract stays consistent across the
// API and migrations only have to happen in one place.
//
// One round-trip pattern:
//   SELECT *, COUNT(*) OVER() AS _total FROM <table>
//   <where> <orderBy> LIMIT $L OFFSET $O
//
// COUNT(*) OVER() is a window function that runs alongside the page
// query, so the total row count comes back in the same statement —
// avoiding the extra round-trip a separate SELECT COUNT(*) would need.
// Postgres still has to scan the matching set once to compute it; for
// tables with a stable filter (e.g. tenant_id) this is fast enough.
//
// Caller passes a base SQL string with $1..$N placeholders and the
// matching params. We append LIMIT/OFFSET as the next two placeholders.

const { pool } = require("./index");
const { parsePage } = require("../lib/pagination");

async function paginatedQuery({ baseSql, baseParams = [], orderBy, query }) {
  if (!pool) throw new Error("paginatedQuery: pool unavailable");
  if (!baseSql) throw new Error("paginatedQuery: baseSql required");
  if (!orderBy) throw new Error("paginatedQuery: orderBy required (stable sort needed for pagination)");
  const { limit, offset } = parsePage(query || {});

  const limitIdx = baseParams.length + 1;
  const offsetIdx = baseParams.length + 2;
  // The window-function trick: SELECT *, COUNT(*) OVER() AS _total. We
  // strip _total from each row before returning so callers see clean
  // record shapes; the total is hoisted out separately.
  const text = `
    SELECT page.*, COUNT(*) OVER() AS _total
    FROM (${baseSql}) page
    ${orderBy ? `ORDER BY ${orderBy}` : ""}
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;
  const params = [...baseParams, limit, offset];
  const r = await pool.query(text, params);
  const total = r.rows.length > 0 ? Number(r.rows[0]._total) : 0;
  const data = r.rows.map(({ _total, ...rest }) => rest);
  return { data, total, limit, offset };
}

module.exports = { paginatedQuery };
