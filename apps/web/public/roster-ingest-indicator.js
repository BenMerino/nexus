// Live ingest indicator for the roster page. Polls roster-ingest-status and
// renders a progress banner while a background paper-ingest is running, then a
// brief done/error state. Exposes window.rosterIngestIndicator.poll(tenantId);
// roster-app calls it on load and after an import that kicks auto-ingest.
//
// SPA contract (legacy-mount.ts): mount() is re-runnable and returns a cleanup
// that clears the chained poll timer, so leaving the /roster route stops
// polling. The window hook is (re)published on every mount.
export function mount() {
  var pollTimer = null;

  function poll(tenantId) {
    fetch("/api/auth?action=roster-ingest-status&tenantId=" + tenantId)
      .then(function (r) { return r.json(); })
      .then(function (s) {
        if (!s.ok) return;
        render(s);
        if (s.state === "running") {
          clearTimeout(pollTimer);
          pollTimer = setTimeout(function () { poll(tenantId); }, 4000);
        }
      })
      .catch(function () {});
  }

  function render(s) {
    var banner = document.getElementById("ingest-banner");
    if (!s || s.state === "idle") { banner.style.display = "none"; return; }
    banner.style.display = "flex";
    var text = document.getElementById("ingest-banner-text");
    var bar = document.getElementById("ingest-banner-bar");
    var pct = document.getElementById("ingest-banner-pct");
    var pulse = document.getElementById("ingest-banner-pulse");
    if (s.state === "running") {
      var p = s.total ? Math.round((s.processed / s.total) * 100) : 0;
      pulse.style.display = "";
      text.textContent = "Ingesting publications — " + s.processed + "/" + (s.total || "?") + " academics, " + s.imported + " papers so far";
      bar.style.width = p + "%";
      pct.textContent = p + "%";
    } else if (s.state === "done") {
      pulse.style.display = "none";
      text.textContent = "Publication ingest complete — " + s.imported + " papers imported across " + s.processed + " academics.";
      bar.style.width = "100%";
      pct.textContent = "done";
    } else if (s.state === "error") {
      pulse.style.display = "none";
      text.textContent = "Publication ingest stopped: " + (s.error || "error") + " (re-run to resume).";
      bar.style.width = "0%";
      pct.textContent = "error";
    }
  }

  window.rosterIngestIndicator = { poll: poll };

  // Tear down the chained poll when React unmounts the page.
  return function cleanup() { clearTimeout(pollTimer); };
}
