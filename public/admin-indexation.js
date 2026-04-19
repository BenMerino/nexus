(function () {
  function refreshCounts() {
    fetch("/api/indexation").then(r => r.json()).then(function (d) {
      var el = document.getElementById("indexation-counts");
      if (!el) return;
      var counts = (d && d.counts) || [];
      if (!counts.length) { el.textContent = "No journal lists imported yet."; return; }
      el.innerHTML = counts.map(function (c) {
        return '<span style="margin-right:14px;"><strong>' + c.source + '</strong>: ' + c.count.toLocaleString() + " journals</span>";
      }).join("");
    }).catch(function () {});
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
      fetch("/api/indexation", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: reader.result, source: src }),
      }).then(r => r.json()).then(function (d) {
        if (d.error) { status.textContent = "Error: " + d.error; return; }
        var imp = d.imported || {}, bf = d.backfill || {};
        status.textContent = "Imported " + imp.count + " " + imp.source + " journals. Tagged " + bf.tagged + " paper-source pairs (scanned " + bf.scanned + ").";
        refreshCounts();
      }).catch(function (err) { status.textContent = "Error: " + err.message; });
    };
    reader.readAsText(file);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", refreshCounts);
  } else {
    refreshCounts();
  }
})();
