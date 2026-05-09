const { ensureSchema, getAllRecords } = require("../src/lib/db");
const { requireScope } = require("../src/lib/scope");
const { parsePage, envelope } = require("../src/lib/pagination");

// /api/records returns the full record set by default (legacy shape: a
// flat array). When ?paginated=1 is passed, returns the standard
// pagination envelope { data, pagination: { total, limit, offset, ... } }
// so new callers can page without breaking existing SPA code that expects
// the array.
module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  await ensureSchema();
  const scope = await requireScope(req, res);
  if (!scope) return;
  try {
    const all = (await getAllRecords(scope)).map((r) => ({
      ...r,
      authors: r.authors ? JSON.parse(r.authors) : [],
      affiliations: r.affiliations ? JSON.parse(r.affiliations) : [],
    }));
    if (req.query.paginated === "1") {
      const { limit, offset } = parsePage(req.query);
      const slice = all.slice(offset, offset + limit);
      return res.json(envelope({ data: slice, total: all.length, limit, offset }));
    }
    res.json(all);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
