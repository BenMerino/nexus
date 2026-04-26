const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = __dirname;
const SRC = path.join(root, "public");
const OUT = path.join(root, "dist");

// ── 1. Clean output ─────────────────────────────────────────────────────
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// ── 2. Bundles via esbuild, with content-hashed filenames ───────────────
const shimPlugin = {
  name: "shim-resolver",
  setup(build) {
    build.onResolve({ filter: /graph-composer\.types/ }, () => ({
      path: path.join(root, "architect", "graph-composer.types.ts"),
    }));
    build.onResolve({ filter: /primitives\/BaseBox/ }, () => ({ path: path.join(root, "primitives", "BaseBox.tsx") }));
    build.onResolve({ filter: /primitives\/BaseText/ }, () => ({ path: path.join(root, "primitives", "BaseText.tsx") }));
    build.onResolve({ filter: /primitives\/BaseAction/ }, () => ({ path: path.join(root, "primitives", "BaseAction.tsx") }));
  },
};

const bundles = [
  { entry: "public/charts.tsx",          name: "charts-bundle" },
  { entry: "public/relationships.tsx",   name: "relationships-bundle" },
  { entry: "public/dashboard-charts.tsx",name: "dashboard-bundle" },
  { entry: "public/tenant.tsx",          name: "tenant-bundle" },
  { entry: "public/shell-mount.tsx",     name: "shell-mount-bundle" },
  { entry: "public/collaborators.tsx",   name: "collaborators-bundle" },
];

(async () => {
  // ── 3. esbuild → dist/ with [name]-[hash].js ─────────────────────────
  const esbuildResults = await esbuild.build({
    entryPoints: bundles.map(b => b.entry),
    outdir: OUT,
    bundle: true,
    format: "esm",
    jsx: "automatic",
    loader: { ".tsx": "tsx", ".ts": "ts" },
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [shimPlugin],
    entryNames: "[name]-[hash]",
    metafile: true,
  });

  // Rename esbuild outputs from <entry-basename>-<hash>.js to
  // <logical-name>-<hash>.js so the served URL matches what HTML pages
  // already reference (e.g. dashboard-charts.tsx → dashboard-bundle-AB12.js).
  const manifest = {};
  const entryByBaseName = new Map(bundles.map(b => [path.basename(b.entry, path.extname(b.entry)), b.name]));
  for (const outPath of Object.keys(esbuildResults.metafile.outputs)) {
    const oldName = path.basename(outPath);
    const m = oldName.match(/^(.+)-([A-Z0-9]+)\.js$/);
    if (!m) continue;
    const logical = entryByBaseName.get(m[1]);
    if (!logical) continue;
    const newName = `${logical}-${m[2]}.js`;
    if (newName !== oldName) {
      fs.renameSync(path.join(OUT, oldName), path.join(OUT, newName));
    }
    manifest[logical + ".js"] = newName;
  }

  // ── 4. Hash & copy vanilla JS + CSS that any HTML references ─────────
  const htmlFiles = fs.readdirSync(SRC).filter(n => n.endsWith(".html"));
  const refRe = /(?:src|href)=["']\/([^"'?]+\.(?:js|css))(?:\?[^"']*)?["']/g;
  const referenced = new Set();
  for (const f of htmlFiles) {
    const html = fs.readFileSync(path.join(SRC, f), "utf8");
    let m;
    while ((m = refRe.exec(html)) !== null) referenced.add(m[1]);
  }

  // Skip ones already produced by esbuild (they're bundles).
  const bundleLogicalNames = new Set(bundles.map(b => b.name + ".js"));
  for (const rel of referenced) {
    if (bundleLogicalNames.has(rel)) continue;
    const src = path.join(SRC, rel);
    if (!fs.existsSync(src)) {
      console.warn(`  warn: HTML references ${rel} but it doesn't exist`);
      continue;
    }
    const buf = fs.readFileSync(src);
    const hash = crypto.createHash("sha256").update(buf).digest("hex").slice(0, 8).toUpperCase();
    const ext = path.extname(rel);
    const base = rel.slice(0, -ext.length);
    const hashed = `${base}-${hash}${ext}`;
    fs.mkdirSync(path.dirname(path.join(OUT, hashed)), { recursive: true });
    fs.writeFileSync(path.join(OUT, hashed), buf);
    manifest[rel] = hashed;
  }

  // ── 5. Rewrite each HTML, swapping logical refs for hashed ones ──────
  // Preserve the surrounding attribute (src= or href=) and quote characters,
  // but replace the path entirely so any stale querystring is dropped.
  const rewriteRe = /(src|href)=(["'])\/([^"'?]+\.(?:js|css))(?:\?[^"']*)?\2/g;
  for (const f of htmlFiles) {
    const srcPath = path.join(SRC, f);
    let html = fs.readFileSync(srcPath, "utf8");
    html = html.replace(rewriteRe, (whole, attr, q, rel) => {
      const hashed = manifest[rel];
      if (!hashed) return whole;
      return `${attr}=${q}/${hashed}${q}`;
    });
    fs.writeFileSync(path.join(OUT, f), html);
  }

  // ── 6. Copy through any other static assets (images, fonts, etc.) ────
  // Skip source-only files: .ts, .tsx, .map.
  const SKIP_EXT = new Set([".ts", ".tsx", ".map"]);
  const SKIP_NAME = new Set();
  const walk = (dir, rel = "") => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const r = path.join(rel, entry.name);
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(abs, r); continue; }
      if (entry.name.endsWith(".html")) continue;     // already handled
      if (entry.name.endsWith(".js") || entry.name.endsWith(".css")) continue; // hashed above (or unreferenced source)
      if (SKIP_EXT.has(path.extname(entry.name))) continue;
      if (SKIP_NAME.has(entry.name)) continue;
      const dst = path.join(OUT, r);
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(abs, dst);
    }
  };
  walk(SRC);

  // ── 7. Write manifest for debugging / future tooling ─────────────────
  fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));

  const bundleCount = bundles.length;
  const hashedCount = Object.keys(manifest).length;
  console.log(`Build → dist/: ${bundleCount} bundles, ${hashedCount} hashed assets, ${htmlFiles.length} HTML pages`);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
