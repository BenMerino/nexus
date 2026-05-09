// Pagination helpers shared by list endpoints. Mirrors Zincro's per-list
// approach: parse limit/offset from req.query, clamp to safe ranges, and
// return a `{ data, total, limit, offset, has_more }` envelope so frontend
// callers always know how many rows exist and whether more pages remain.
//
// Limit defaults to 50 (Zincro's typical page size) and clamps to 200.
// Offset is unbounded but caller can pass `maxOffset` when needed.

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function parsePage(query) {
  const limit = clampInt(query.limit, DEFAULT_LIMIT, 1, MAX_LIMIT);
  const offset = clampInt(query.offset, 0, 0, Number.MAX_SAFE_INTEGER);
  return { limit, offset };
}

function clampInt(raw, fallback, min, max) {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

// Wrap a `{ rows, total }` result into the standard pagination envelope.
function envelope({ data, total, limit, offset }) {
  return {
    data,
    pagination: {
      total,
      limit,
      offset,
      has_more: offset + data.length < total,
      next_offset: offset + data.length < total ? offset + limit : null,
    },
  };
}

module.exports = { parsePage, envelope, DEFAULT_LIMIT, MAX_LIMIT };
