const esbuild = require("esbuild");
const path = require("path");

const root = __dirname;

const shimPlugin = {
  name: "shim-resolver",
  setup(build) {
    // Resolve architect types
    build.onResolve({ filter: /graph-composer\.types/ }, () => ({
      path: path.join(root, "architect", "graph-composer.types.ts"),
    }));
    // Resolve primitives
    build.onResolve({ filter: /primitives\/BaseBox/ }, () => ({
      path: path.join(root, "primitives", "BaseBox.tsx"),
    }));
    build.onResolve({ filter: /primitives\/BaseText/ }, () => ({
      path: path.join(root, "primitives", "BaseText.tsx"),
    }));
    build.onResolve({ filter: /primitives\/BaseAction/ }, () => ({
      path: path.join(root, "primitives", "BaseAction.tsx"),
    }));
  },
};

const shared = {
  bundle: true,
  format: "esm",
  jsx: "automatic",
  loader: { ".tsx": "tsx", ".ts": "ts" },
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [shimPlugin],
};

Promise.all([
  esbuild.build({
    ...shared,
    entryPoints: ["public/charts.tsx"],
    outfile: "public/charts-bundle.js",
  }),
  esbuild.build({
    ...shared,
    entryPoints: ["public/relationships.tsx"],
    outfile: "public/relationships-bundle.js",
  }),
  esbuild.build({
    ...shared,
    entryPoints: ["public/dashboard-charts.tsx"],
    outfile: "public/dashboard-bundle.js",
  }),
  esbuild.build({
    ...shared,
    entryPoints: ["public/portfolio.tsx"],
    outfile: "public/portfolio-bundle.js",
  }),
  esbuild.build({
    ...shared,
    entryPoints: ["public/tenant.tsx"],
    outfile: "public/tenant-bundle.js",
  }),
  esbuild.build({
    ...shared,
    entryPoints: ["public/shell-mount.tsx"],
    outfile: "public/shell-mount-bundle.js",
  }),
])
  .then(() => {
    const fs = require("fs");
    const ts = String(Date.now());
    // Write version file for live reload polling
    fs.writeFileSync("public/build-version.txt", ts);
    // Auto-bump cache buster in HTML files
    for (const f of ["public/overview.html", "public/explore.html"]) {
      try {
        const html = fs.readFileSync(f, "utf8");
        const updated = html.replace(/relationships-bundle\.js\?v=\d+/, `relationships-bundle.js?v=${ts}`);
        if (updated !== html) fs.writeFileSync(f, updated);
      } catch {}
    }
    try {
      const html = fs.readFileSync("public/portfolio.html", "utf8");
      const updated = html.replace(/portfolio-bundle\.js\?v=\d+/, `portfolio-bundle.js?v=${ts}`);
      if (updated !== html) fs.writeFileSync("public/portfolio.html", updated);
    } catch {}
    console.log("Build complete: charts-bundle.js, relationships-bundle.js, dashboard-bundle.js, portfolio-bundle.js, tenant-bundle.js, shell-mount-bundle.js");
  })
  .catch(() => process.exit(1));
