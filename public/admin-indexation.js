(function () {
  function refreshCounts() {
    fetch("/api/indexation").then(r => r.json()).then(function (d) {
      var el = document.getElementById("indexation-counts");
      if (!el) return;
      var counts = (d && d.counts) || [];
      if (!counts.length) { el.textContent = "No journal lists imported yet."; return; }
      el.innerHTML = counts.map(function (c) {
        var when = c.last_seeded_at ? " (" + new Date(c.last_seeded_at).toISOString().slice(0, 10) + ")" : "";
        return '<span style="margin-right:14px;"><strong>' + c.source + '</strong>: ' + c.count.toLocaleString() + " journals" + when + "</span>";
      }).join("");
    }).catch(function () {});
  }

  function postSeed(source, body, status) {
    return fetch("/api/indexation?action=seed&source=" + encodeURIComponent(source), {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    }).then(r => r.json()).then(function (d) {
      if (d.error) { status.textContent = "Error: " + d.error; return; }
      var imp = d.imported || {}, bf = d.backfill || {};
      status.textContent = "Seeded " + imp.count + " " + imp.source + " journals. Tagged " + bf.tagged + " paper-source pairs (scanned " + bf.scanned + ").";
      refreshCounts();
    }).catch(function (err) { status.textContent = "Error: " + err.message; });
  }

  window.idxImport = function () {
    var src = document.getElementById("idx-source").value;
    var file = document.getElementById("idx-file").files[0];
    var status = document.getElementById("idx-status");
    if (!file) { status.textContent = "Choose a CSV file."; return; }
    status.textContent = "Reading " + file.name + "…";
    var reader = new FileReader();
    reader.onload = function () {
      status.textContent = "Importing " + src + " and backfilling tags…";
      postSeed(src, { csv: reader.result }, status);
    };
    reader.readAsText(file);
  };

  window.idxSeedScielo = function () {
    var status = document.getElementById("idx-status");
    status.textContent = "Fetching SciELO identifiers and backfilling tags…";
    postSeed("SciELO", null, status);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", refreshCounts);
  } else {
    refreshCounts();
  }
})();
