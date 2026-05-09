// File upload endpoint using presigned URLs. Mirrors Zincro's
// apps/api/src/routes/filesRoutes.ts shape: GET /api/files?action=presign
// returns a presigned PUT URL the browser uploads directly to. The API
// never streams the bytes — only mints the URL.
//
// Handler matches the Vercel-style signature so it auto-mounts via index.js.

const { presignUpload, isConfigured, publicUrl } = require("../src/lib/storage");
const { getUser } = require("../src/lib/auth");
const crypto = require("crypto");

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!isConfigured()) {
    return res.status(503).json({
      error: "Object storage not configured",
      hint: "Provision Railway Object Storage and set S3_* env vars",
    });
  }
  const session = getUser(req);
  if (!session) return res.status(401).json({ error: "Not authenticated" });

  const action = req.query.action || "presign";
  if (action === "presign") {
    // Body shape: { filename, contentType }. We mint a unique key under
    // the user's tenant prefix to avoid collisions and to make per-tenant
    // cleanup easy.
    const filename = (req.body && req.body.filename) || req.query.filename;
    const contentType = (req.body && req.body.contentType) || req.query.contentType || "application/octet-stream";
    if (!filename) return res.status(400).json({ error: "filename required" });
    const tenantPrefix = session.tenantId ? `tenant-${session.tenantId}` : "no-tenant";
    const key = `${tenantPrefix}/${Date.now()}-${crypto.randomUUID()}-${filename}`;
    const uploadUrl = await presignUpload(key, contentType, 300);
    return res.json({ key, uploadUrl, publicUrl: publicUrl(key) });
  }
  return res.status(400).json({ error: `unknown action: ${action}` });
};
