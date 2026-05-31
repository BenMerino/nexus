import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readdirSync } from "fs";
import { resolve } from "path";

const SRC = resolve(__dirname, "public");
const htmlEntries = Object.fromEntries(
  readdirSync(SRC)
    .filter(f => f.endsWith(".html"))
    .map(f => [f.replace(/\.html$/, ""), resolve(SRC, f)]),
);

// Before the first style computation: (1) set data-theme="light" when the OS
// is in light mode so the page doesn't paint the wrong baseline, and (2) apply
// the tenant's configured surface tokens (cached in localStorage by
// loadThemeTokens) for the active mode, so a customized --bg/--fg/... doesn't
// flash from the CSS baseline to the configured color once the async
// /api/theme-tokens fetch resolves. Synchronous, runs as the first thing in
// <head>. The token slug list must stay in sync with SURFACE_TOKEN_KEYS.
const THEME_BOOT = `<script>try{var m=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';var d=document.documentElement;if(m==='light')d.setAttribute('data-theme','light');var t=JSON.parse(localStorage.getItem('nexus.theme-tokens')||'null');if(t){var ks=['bg','bg-elev','bg-card','border','fg','fg-muted','accent'];for(var i=0;i<ks.length;i++){var v=t['theme-'+m+'-'+ks[i]];if(v)d.style.setProperty('--'+ks[i],v)}}}catch(e){}</script>`;

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
