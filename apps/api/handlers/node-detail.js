const { ensureSchema } = require("../src/lib/db");
const { requireScope } = require("../src/lib/scope");
const { authorDetail, institutionDetail, journalDetail, paperDetail } = require("../src/lib/node-detail-resolvers");

module.exports = async function handler(req, res) {
  await ensureSchema();
  const scope = await requireScope(req, res);
  if (!scope) return;
  const id = req.query.id;
  if (!id) return res.status(400).json({ error: "id is required" });
  const colonIdx = id.indexOf(":");
  if (colonIdx < 0) return res.status(400).json({ error: "invalid id" });
  const group = id.slice(0, colonIdx);
  const key = id.slice(colonIdx + 1);
  const isOrcid = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(key);
  const isRor   = /^0[0-9a-z]{8}$/.test(key);
  const isIssn  = /^\d{4}-\d{3}[\dX]$/.test(key);
  try {
    let d = null;
    if (group === "author")      d = await authorDetail(scope, isOrcid ? key : null, key);
    else if (group === "institution") d = await institutionDetail(scope, isRor ? key : null, key);
    else if (group === "journal")     d = await journalDetail(scope, isIssn ? key : null, key);
    else if (group === "doi")         d = await paperDetail(scope, key);
    else return res.status(400).json({ error: "unknown group" });
    if (!d) return res.status(404).json({ error: "not found" });
    res.json(d);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
