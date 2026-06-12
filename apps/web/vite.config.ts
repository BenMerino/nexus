import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readdirSync, mkdirSync, copyFileSync, existsSync } from "fs";
import { resolve } from "path";

const SRC = resolve(__dirname, "public");
const htmlEntries = Object.fromEntries(
  readdirSync(SRC)
    .filter(f => f.endsWith(".html"))
    .map(f => [f.replace(/\.html$/, ""), resolve(SRC, f)]),
);

// Before the first style computation: (1) pick the active mode — a visitor's
// pinned choice (nexus.public-theme, set by the public dashboard's toggle) wins
// over the OS prefers-color-scheme — and set data-theme so the page doesn't
// paint the wrong baseline, and (2) apply the tenant's configured surface
// tokens (cached in localStorage by loadThemeTokens) for the active mode, so a
// customized --bg/--fg/... doesn't flash from the CSS baseline to the
// configured color once the async /api/theme-tokens fetch resolves.
// Synchronous, runs as the first thing in <head>. The token slug list must stay
// in sync with SURFACE_TOKEN_KEYS; the pinned-key name with PUBLIC_THEME_KEY.
const THEME_BOOT = `<script>try{var p=localStorage.getItem('nexus.public-theme');var m=(p==='light'||p==='dark')?p:(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');var d=document.documentElement;if(m==='light')d.setAttribute('data-theme','light');var t=JSON.parse(localStorage.getItem('nexus.theme-tokens')||'null');if(t){var ks=['bg','bg-elev','bg-card','border','fg','fg-muted','accent'];for(var i=0;i<ks.length;i++){var v=t['theme-'+m+'-'+ks[i]];if(v)d.style.setProperty('--'+ks[i],v)}}}catch(e){}</script>`;

export default defineConfig({
  root: SRC,
  publicDir: false,
  plugins: [
    react(),
    {
      name: "nexus-theme-boot",
      transformIndexHtml: {
        order: "pre",
        handler: (html) => html.replace("</title>", "</title>\n  " + THEME_BOOT),
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
    proxy: { "/api": "http://localhost:3000" },
  },
});
