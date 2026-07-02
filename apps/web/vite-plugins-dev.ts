// Dev-only Vite plugins (both apply:"serve" — never part of a build, never
// deployed). Split from vite.config.ts (N5).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const SRC = resolve(__dirname, "public");

// A legacy page that has migrated to a React-Router SPA route leaves behind a
// redirect stub at <name>.html (meta-refresh + location.replace) so old links
// like /dashboard.html still bounce to the new /dashboard. In production Caddy
// resolves /dashboard via `try_files {path} /index.html` (NO {path}.html step),
// so it falls through to the SPA. Vite's dev server, in MPA mode, instead maps
// /dashboard → dashboard.html (the stub), which redirects to /dashboard, which
// resolves to the stub again — an infinite refresh loop in `dev:web` only.
//
// This plugin mirrors Caddy in dev: for an extensionless GET whose matching
// <name>.html is a redirect stub, serve index.html (the SPA) instead. Detecting
// "is a stub" from file content auto-covers every migrated route (and future
// ones) with no hardcoded path list.
const STUB_RE = /http-equiv=["']refresh["']|location\.replace/i;
function isRedirectStub(htmlPath: string): boolean {
  try { return STUB_RE.test(readFileSync(htmlPath, "utf8")); }
  catch { return false; }
}
export const spaRouteFallback = {
  name: "nexus-spa-route-fallback",
  apply: "serve" as const,
  configureServer(server: import("vite").ViteDevServer) {
    server.middlewares.use((req, _res, next) => {
      const url = (req.url || "").split("?")[0];
      // Public tenant routes — mirror Caddy in dev so the /t/:slug[/<entity>]
      // path form serves tenant.html (and /t/:slug/a/:orcid serves author.html),
      // not the SPA index. Without this, dev only works via ?slug= query.
      if (/^\/t\/[^/]+\/a\/[^/]+$/.test(url)) { req.url = "/author.html"; return next(); }
      if (/^\/t\/[^/]+(\/(faculties|academics|papers|journals)(\/[^/]+)?)?$/.test(url)) { req.url = "/tenant.html"; return next(); }
      // extensionless path (a route, not an asset/.html), e.g. /dashboard
      if (/^\/[^.]*$/.test(url) && url !== "/") {
        const stub = resolve(SRC, `${url.slice(1)}.html`);
        if (existsSync(stub) && isRedirectStub(stub)) {
          req.url = "/index.html";
        }
      }
      next();
    });
  },
};
// DEV-ONLY telemetry sink for visual debugging: __kubeDebug.snap()/report()
// (lg/kube-debug.ts) POST probe images + diagnostics here; they land as files
// under .lg-telemetry/ (gitignored) where the assistant/dev can open them.
// apply:"serve" — never part of a build, never deployed.
export const lgTelemetry = {
  name: "nexus-lg-telemetry",
  apply: "serve" as const,
  configureServer(server: import("vite").ViteDevServer) {
    server.middlewares.use("/__lg-telemetry", (req, res) => {
      if (req.method !== "POST") { res.statusCode = 405; return res.end(); }
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        try {
          const { name, dataUrl, json } = JSON.parse(Buffer.concat(chunks).toString());
          const dir = resolve(__dirname, ".lg-telemetry");
          mkdirSync(dir, { recursive: true });
          const safe = String(name).replace(/[^\w.-]/g, "_").slice(0, 80);
          const stamp = Date.now();
          if (dataUrl) {
            const b64 = String(dataUrl).split(",")[1] || "";
            writeFileSync(resolve(dir, `${stamp}-${safe}.png`), Buffer.from(b64, "base64"));
          }
          if (json !== undefined) {
            writeFileSync(resolve(dir, `${stamp}-${safe}.json`), JSON.stringify(json, null, 2));
          }
          res.statusCode = 204; res.end();
        } catch (e) {
          res.statusCode = 400; res.end(String(e));
        }
      });
    });
  },
};
