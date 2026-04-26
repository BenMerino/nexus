// Catch-all for /*.js and /*.css that don't exist in dist/assets/.
// Triggered when a browser has a stale cached HTML referencing asset names
// from a previous build. Returns a one-shot reload that pulls fresh HTML
// (no-store) and converges the user onto the current build.
module.exports = function handler(req, res) {
  const ext = (req.query && req.query.ext) || "js";
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  if (ext === "css") {
    res.setHeader("Content-Type", "text/css; charset=utf-8");
    res.status(200).send("/* obsolete asset; reload pending */");
    return;
  }
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.status(200).send(
    '(function(){try{if(sessionStorage.getItem("nx-reload-once"))return;sessionStorage.setItem("nx-reload-once","1");location.reload()}catch(e){location.reload()}})();'
  );
};
