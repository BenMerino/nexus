const { ensureSchema } = require("../src/lib/db");
const { requireScope, actorContext } = require("../src/lib/scope");
const { statistician } = require("../src/services/catalog/Statistician");

// The graph node-id group → Statistician node kind. The graph uses "doi" for
// papers; the resolver's kind is "paper".
const KIND = { author: "author", institution: "institution", journal: "journal", doi: "paper" };

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
  const kind = KIND[group];
  if (!kind) return res.status(400).json({ error: "unknown group" });
  const isOrcid = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(key);
  const isRor   = /^0[0-9a-z]{8}$/.test(key);
  const isIssn  = /^\d{4}-\d{3}[\dX]$/.test(key);
  // ext_id is the typed identifier (orcid/ror/issn) when it matches; otherwise
  // null and the label carries the name. paperDetail ignores ext_id/label.
  const matchesId = (kind === "author" && isOrcid) || (kind === "institution" && isRor) || (kind === "journal" && isIssn);
  try {
    const ctx = await actorContext(req);
    const d = await statistician.node(ctx, kind, kind === "paper" ? key : (matchesId ? key : null), key);
    if (!d) return res.status(404).json({ error: "not found" });
    res.json(d);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
