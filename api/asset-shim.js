// Fallback for /*.js and /*.css when the static file doesn't exist in dist/.
// Returns a one-shot reload shim so a stale-cached HTML referencing an old
// hashed asset gets the user back onto the current build automatically,
// instead of seeing a 404 and a dead page.
module.exports = function handler(req, res) {
  const ext = (req.query && req.query.ext) || "js";
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  if (ext === "css") {
    res.setHeader("Content-Type", "text/css; charset=utf-8");
    res.status(200).send("/* obsolete asset; reload to fetch the current build */");
    return;
  }
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.status(200).send(
    '(function(){try{if(sessionStorage.getItem("nx-reload-once"))return;sessionStorage.setItem("nx-reload-once","1");location.reload()}catch(e){location.reload()}})();'
  );
};
