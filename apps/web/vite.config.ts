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

// Sets data-theme="light" before the first style computation when the OS
// is in light mode, so the page doesn't paint dark first and then flash to
// light (or vice versa). Synchronous, runs as the first thing in <head>.
const THEME_BOOT = `<script>try{if(matchMedia('(prefers-color-scheme: light)').matches)document.documentElement.setAttribute('data-theme','light')}catch(e){}</script>`;

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
