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
    const scriptRe = /(<script[^>]*\s)src=(["'])((?:\/|\.\/)[^"'?]+\.js)(?:\?[^"']*)?\2+/g;
    const linkRe   = /(<link[^>]*\s)href=(["'])((?:\/|\.\/)[^"'?]+\.css)(?:\?[^"']*)?\2+/g;
    const stamp = (attr) => (_m, pre, q, url) => `${pre}${attr}=${q}${url}?v=${ts}${q}`;
    // Self-healing inline guard: if the HTML in the browser is stale
    // (build-version on server differs from the one baked in here), force a
    // hard reload once. sessionStorage prevents reload loops if the fetch
    // itself fails. Marker comments let us replace the block on every build.
    const guardMarker = "<!--CLAUSTRO-VERSION-GUARD-->";
    const guard = `${guardMarker}<script>(function(){var V="${ts}";try{fetch("/build-version.txt?_="+Date.now(),{cache:"no-store"}).then(function(r){return r.text()}).then(function(t){t=t.trim();if(t&&t!==V&&sessionStorage.getItem("nx-reload")!==t){sessionStorage.setItem("nx-reload",t);location.replace(location.pathname+"?fresh="+t)}})}catch(e){}})();</script>${guardMarker}`;
    const guardRe = new RegExp(guardMarker + "[\\s\\S]*?" + guardMarker, "g");
    for (const f of fs.readdirSync("public").filter(n => n.endsWith(".html"))) {
      const p = `public/${f}`;
      const before = fs.readFileSync(p, "utf8");
      let after = before.replace(scriptRe, stamp("src")).replace(linkRe, stamp("href"));
      // Strip any previous guard, then inject fresh one right after <head>.
      after = after.replace(guardRe, "");
      after = after.replace(/<head>/, "<head>" + guard);
      if (after !== before) fs.writeFileSync(p, after);
    }
    console.log(`Build complete (v=${ts}): bundles + HTML stamped + version guard`);
  })
  .catch(() => process.exit(1));
