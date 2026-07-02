import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readdirSync, mkdirSync, copyFileSync, existsSync } from "fs";
import { resolve } from "path";
import { spaRouteFallback, lgTelemetry } from "./vite-plugins-dev";

const SRC = resolve(__dirname, "public");

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
// (nexus.sky-mode): 'day' → light, 'night' → dark, absent → OS preference.
// Synchronous, first thing in <head>. Keep the key name in sync with
// SKY_MODE_KEY (sky/sky-mode.ts).
// Also set data-lg (+ data-lg-liquid) pre-paint so the (default-on) vendored
// library glass applies before first paint — no flash of nexus's own glass.
// Default mode is 'liquid' when unset — refraction is per-element size-matched
// and scoped to card-scale surfaces (lg/kube-filter.ts); only an explicit
// 'off' clears it. Keep default + attrs in sync with lg-glass.ts.
const THEME_BOOT = `<script>try{var sm=localStorage.getItem('nexus.sky-mode');var m=sm==='day'?'light':sm==='night'?'dark':(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');document.documentElement.setAttribute('data-theme',m);var lg=localStorage.getItem('nexus.lg-glass.v2')||'liquid';if(lg!=='off'){document.documentElement.setAttribute('data-lg','');if(lg==='liquid'){document.documentElement.setAttribute('data-lg-liquid','')}}}catch(e){}</script>`;

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
    lgTelemetry,
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
