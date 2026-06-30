import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readdirSync, mkdirSync, copyFileSync, existsSync, readFileSync } from "fs";
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
const spaRouteFallback = {
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
const htmlEntries = Object.fromEntries(
  readdirSync(SRC)
    .filter(f => f.endsWith(".html"))
    .map(f => [f.replace(/\.html$/, ""), resolve(SRC, f)]),
);
// The sky background is injected into every page (not imported by any HTML), so
// register it as its own entry to get a stable bundled chunk.
htmlEntries["sky-bg"] = resolve(SRC, "sky/sky-bg.ts");

// Before the first style computation, set data-theme so the page doesn't paint
// the wrong baseline. The sky pipeline (sky-bg.ts) owns the surface tokens, but
// it loads async — so here we set data-theme from the sticky sky mode
// (nexus.sky-mode): 'day' → light, 'night' → dark, 'live'/absent → a coarse OS
// guess (the module corrects to the real sun within a frame). Synchronous, first
// thing in <head>. Keep the key name in sync with SKY_MODE_KEY (sky/sky-mode.ts).
const THEME_BOOT = `<script>try{var sm=localStorage.getItem('nexus.sky-mode');var m=sm==='day'?'light':sm==='night'?'dark':(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');document.documentElement.setAttribute('data-theme',m)}catch(e){}</script>`;

// Live sun-driven sky background, injected into EVERY page (self-mounting module
// that prepends a fixed canvas behind all content). Source-path tag; Vite serves
// it in dev and bundles it in build (sky-bg is a rollup input below).
const SKY_BG = `<script type="module" src="/sky/sky-bg.ts"></script>`;

// Webfonts — the one-family model: Inter (all UI text) + JetBrains Mono
// (technical microcopy). Injected into EVERY page <head> so the families named
// in shared.css (--sans/--mono) actually load instead of falling back to system
// fonts. preconnect warms the Google Fonts hosts; display=swap avoids a blocking
// FOUT. (Privacy note: this is a third-party request; self-host woff2 later if a
// restricted-network tenant needs it — swap this constant for local @font-face.)
const FONT_LINKS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap">`;

export default defineConfig({
  root: SRC,
  publicDir: false,
  plugins: [
    spaRouteFallback,
    react(),
    {
      name: "nexus-theme-boot",
      transformIndexHtml: {
        order: "pre",
        handler: (html) =>
          html.replace("</title>", "</title>\n  " + FONT_LINKS + "\n  " + THEME_BOOT + "\n  " + SKY_BG),
      },
    },
    {
      // Per-tenant social meta on the public pages: at BUILD time only, plant a
      // Caddy `templates` marker ([[% %]] delimiters — brace-free because
      // Railway's railpack Go-template-parses the Caddyfile that declares them)
      // in tenant/author HTML. In prod, Caddy replaces it with the API-composed
      // <meta> fragment (httpInclude → /api/public-meta) so link previews carry
      // the tenant's name/logo. Dev never sees the marker (raw text in <head>
      // would render).
      name: "nexus-public-meta-marker",
      apply: "build",
      transformIndexHtml: {
        order: "post",
        handler: (html, ctx) =>
          /(?:^|\/)(tenant|author)\.html$/.test(ctx.filename)
            ? html.replace("</title>", "</title>\n  " +
                '[[% httpInclude (printf "/api/public-meta?uri=%s" .OriginalReq.URL.Path) %]]')
            : html,
      },
    },
    {
      // publicDir is false (this build only bundles HTML entries + their
      // imports), so static data assets under public/geo/ aren't copied. The
      // world-choropleth's geometry is one such asset, fetched at runtime from
      // /geo/world-countries.json — copy it into dist after the bundle.
      name: "nexus-copy-geo",
      closeBundle() {
        const src = resolve(SRC, "geo");
        const dest = resolve(__dirname, "dist", "geo");
        if (!existsSync(src)) return;
        mkdirSync(dest, { recursive: true });
        for (const f of readdirSync(src)) copyFileSync(resolve(src, f), resolve(dest, f));
      },
    },
  ],
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true,
    rollupOptions: { input: htmlEntries },
  },
  server: {
    port: 9000,
    // Default: local API on :3000. Set DEV_API_TARGET to proxy /api at a remote
    // (e.g. the prod web host, which fronts the real API+DB) for data preview
    // without a local DATABASE_URL. changeOrigin/secure handle the HTTPS edge.
    proxy: {
      "/api": process.env.DEV_API_TARGET
        ? { target: process.env.DEV_API_TARGET, changeOrigin: true, secure: true }
        : "http://localhost:3000",
    },
  },
});
