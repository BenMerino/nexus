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
])
  .then(() => console.log("Build complete: charts-bundle.js, relationships-bundle.js"))
  .catch(() => process.exit(1));
