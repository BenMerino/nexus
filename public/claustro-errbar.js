(function () {
  function showError(msg) {
    var view = document.querySelector(".claustro-view") || document.body;
    var bar = document.getElementById("claustro-err-bar");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "claustro-err-bar";
      bar.style.cssText = "background:var(--err);color:#fff;padding:8px 14px;font:12px/1.4 var(--mono);margin-bottom:14px;border-radius:4px;white-space:pre-wrap;";
      view.insertBefore(bar, view.firstChild);
    }
    bar.textContent = msg;
  }
  window.addEventListener("error", function (e) {
    showError("JS error: " + (e.message || e.error) + " @ " + (e.filename || "?") + ":" + (e.lineno || "?"));
  });
  window.addEventListener("unhandledrejection", function (e) {
    showError("Unhandled: " + (e.reason && e.reason.message ? e.reason.message : String(e.reason)));
  });
  function safeFetch(url, opts) {
    return fetch(url, opts).then(function (r) {
      if (r.status === 401) { window.location.href = "/login.html"; throw new Error("401"); }
      if (!r.ok) throw new Error(url + " → " + r.status);
      return r.json();
    });
  }
  function logFetchErr(label) {
    return function (e) {
      if (String(e.message) === "401") return;
      console.error("[claustro] " + label + ":", e);
      showError(label + ": " + e.message);
    };
  }
  window.claustroErr = { showError: showError, safeFetch: safeFetch, logFetchErr: logFetchErr };
})();
