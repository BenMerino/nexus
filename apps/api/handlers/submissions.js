const { ensureSchema, getSubmissions } = require("../src/lib/db");
const { getSubmissionsPage } = require("../src/lib/db-list");
const { requireScope } = require("../src/lib/scope");
const { envelope } = require("../src/lib/pagination");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  await ensureSchema();
  const scope = await requireScope(req, res);
  if (!scope) return;
  try {
    if (req.query.paginated === "1") {
      const page = await getSubmissionsPage(scope, req.query);
      return res.json(envelope(page));
    }
    const submissions = await getSubmissions(scope);
    res.json(submissions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
