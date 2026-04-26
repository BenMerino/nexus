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
    entryPoints: ["public/tenant.tsx"],
    outfile: "public/tenant-bundle.js",
  }),
  esbuild.build({
    ...shared,
    entryPoints: ["public/shell-mount.tsx"],
    outfile: "public/shell-mount-bundle.js",
  }),
  esbuild.build({
    ...shared,
    entryPoints: ["public/collaborators.tsx"],
    outfile: "public/collaborators-bundle.js",
  }),
])
  .then(() => {
    const fs = require("fs");
    const ts = String(Date.now());
    fs.writeFileSync("public/build-version.txt", ts);
    // Stamp ?v=<ts> on every local <script src> and <link href> in every HTML
    // so the browser can never pair a stale HTML with a fresh JS (or vice-versa):
    // both move to the new ?v together, mismatched caches refetch.
    // Matcher accepts one-or-more closing quotes (\2+) so it self-heals files
    // that an earlier buggy build left with duplicated quotes.
    const scriptRe = /(<script[^>]*\s)src=(["'])((?:\/|\.\/)[^"'?]+\.js)(?:\?[^"']*)?\2+/g;
    const linkRe   = /(<link[^>]*\s)href=(["'])((?:\/|\.\/)[^"'?]+\.css)(?:\?[^"']*)?\2+/g;
    const stamp = (attr) => (_m, pre, q, url) => `${pre}${attr}=${q}${url}?v=${ts}${q}`;
    for (const f of fs.readdirSync("public").filter(n => n.endsWith(".html"))) {
      const p = `public/${f}`;
      const before = fs.readFileSync(p, "utf8");
      const after = before.replace(scriptRe, stamp("src")).replace(linkRe, stamp("href"));
      if (after !== before) fs.writeFileSync(p, after);
    }
    console.log(`Build complete (v=${ts}): bundles + HTML cache-stamped`);
  })
  .catch(() => process.exit(1));
