const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

// Load .env.local for local development (no dotenv dependency)
[".env.local", ".env"].forEach(f => {
  const p = path.join(__dirname, f);
  if (!fs.existsSync(p)) return;
  fs.readFileSync(p, "utf8").split("\n").forEach(line => {
    const m = line.match(/^([A-Z_]+)="?(.*?)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/\\n/g, "");
  });
});

const PORT = 9000;
const PUBLIC = path.join(__dirname, "public");

const MIME = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function serveStatic(filePath, res) {
  const ext = path.extname(filePath);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(data);
  });
}

function makeVercelReq(nodeReq, parsedUrl) {
  nodeReq.query = Object.fromEntries(parsedUrl.searchParams);
  return nodeReq;
}

function makeVercelRes(nodeRes) {
  nodeRes.status = (code) => { nodeRes.statusCode = code; return nodeRes; };
  nodeRes.json = (obj) => {
    nodeRes.setHeader("Content-Type", "application/json");
    nodeRes.end(JSON.stringify(obj));
  };
  nodeRes.send = (body) => nodeRes.end(body);
  return nodeRes;
}

function parseBody(req) {
  return new Promise((resolve) => {
    if (req.method === "GET" || req.method === "HEAD") return resolve();
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try { req.body = JSON.parse(body); } catch { req.body = body; }
      resolve();
    });
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = parsedUrl.pathname;
  console.log(`[REQ] ${req.method} ${pathname}`);

  // API routes
  if (pathname.startsWith("/api/")) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    const vReq = makeVercelReq(req, parsedUrl);
    const vRes = makeVercelRes(res);
    await parseBody(vReq);

    try {
      // Dynamic route: /api/records/[id]
      const recordMatch = pathname.match(/^\/api\/records\/(.+)$/);
      if (recordMatch) {
        vReq.query.id = recordMatch[1];
        const handler = require("./api/records/[id]");
        return await handler(vReq, vRes);
      }

      // Static routes: /api/auth, /api/submit, etc.
      const routeFile = path.join(__dirname, pathname + ".js");
      if (fs.existsSync(routeFile)) {
        const handler = require(routeFile);
        return await handler(vReq, vRes);
      }

      res.writeHead(404);
      res.end("API route not found");
    } catch (err) {
      console.error("API error:", err);
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Static files
  let filePath = path.join(PUBLIC, pathname === "/" ? "index.html" : pathname);
  if (!path.extname(filePath) && fs.existsSync(filePath + ".html")) {
    filePath += ".html";
  }
  serveStatic(filePath, res);
});

server.listen(PORT, () => {
  console.log(`Local server running at http://localhost:${PORT}`);
});
