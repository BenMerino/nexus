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

export default defineConfig({
  root: SRC,
  publicDir: false,
  plugins: [react()],
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
