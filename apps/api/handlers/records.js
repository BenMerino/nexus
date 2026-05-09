const { ensureSchema, getAllRecords } = require("../src/lib/db");
const { getRecordsPage } = require("../src/lib/db-list");
const { requireScope } = require("../src/lib/scope");
const { envelope } = require("../src/lib/pagination");

// /api/records returns the full record set by default (legacy shape: a
// flat array). When ?paginated=1 is passed, the SQL is sliced at the
// database (LIMIT/OFFSET pushed into Postgres via getRecordsPage) and
// returns the standard envelope { data, pagination: { total, limit,
// offset, has_more, next_offset } }. The flat-array branch will be
// removed once every SPA caller has migrated.
module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  await ensureSchema();
  const scope = await requireScope(req, res);
  if (!scope) return;
  const parseRow = (r) => ({
    ...r,
    authors: r.authors ? JSON.parse(r.authors) : [],
    affiliations: r.affiliations ? JSON.parse(r.affiliations) : [],
  });
  try {
    if (req.query.paginated === "1") {
      const page = await getRecordsPage(scope, req.query);
      return res.json(envelope({ ...page, data: page.data.map(parseRow) }));
    }
    const all = (await getAllRecords(scope)).map(parseRow);
    res.json(all);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
