(function () {
  var statusEl = function () { return document.getElementById("idx-status"); };

  function fmtDate(iso) {
    return iso ? new Date(iso).toISOString().slice(0, 10) : "never";
  }

  function rowHtml(c) {
    var action = c.seed_kind === "auto"
      ? '<button class="primary-btn" data-reseed="' + c.source + '">Re-seed</button>'
      : '<input type="file" accept=".csv,text/csv" data-csv="' + c.source + '" style="font-size:12px;">'
        + '<button class="primary-btn" data-upload="' + c.source + '" style="margin-left:6px;">Upload CSV</button>';
    return '<tr>'
      + '<td><strong>' + c.source + '</strong></td>'
      + '<td style="font-family:var(--mono);">' + c.count.toLocaleString() + '</td>'
      + '<td style="color:var(--fg-muted);">' + fmtDate(c.last_seeded_at) + '</td>'
      + '<td>' + action + '</td>'
      + '</tr>';
  }

  function render(counts) {
    var host = document.getElementById("indexation-table");
    if (!host) return;
    host.innerHTML = '<table style="width:100%;border-collapse:collapse;font-size:13px;">'
      + '<thead><tr style="text-align:left;color:var(--fg-muted);">'
      + '<th style="padding:6px 8px;">Source</th><th style="padding:6px 8px;">Journals</th>'
      + '<th style="padding:6px 8px;">Last seeded</th><th style="padding:6px 8px;">Action</th>'
      + '</tr></thead><tbody>' + counts.map(rowHtml).join("") + '</tbody></table>';
    host.querySelectorAll("[data-reseed]").forEach(function (b) {
      b.onclick = function () { reseed(b.getAttribute("data-reseed")); };
    });
    host.querySelectorAll("[data-upload]").forEach(function (b) {
      b.onclick = function () { upload(b.getAttribute("data-upload")); };
    });
  }

  function refresh() {
    return fetch("/api/indexation").then(r => r.json()).then(function (d) {
      render((d && d.counts) || []);
    });
  }

  function postSeed(source, body) {
    var s = statusEl();
    s.textContent = "Seeding " + source + "…";
    return fetch("/api/indexation?action=seed&source=" + encodeURIComponent(source), {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    }).then(r => r.json()).then(function (d) {
      if (d.error) { s.textContent = "Error: " + d.error; return; }
      var imp = d.imported || {}, bf = d.backfill || {};
      s.textContent = "Seeded " + imp.count + " " + imp.source + " journals. Tagged " + bf.tagged + " paper-source pairs (scanned " + bf.scanned + ").";
      refresh();
    }).catch(function (err) { s.textContent = "Error: " + err.message; });
  }

  function reseed(source) { postSeed(source, null); }

  function upload(source) {
    var input = document.querySelector('[data-csv="' + source + '"]');
    var file = input && input.files[0];
    if (!file) { statusEl().textContent = "Choose a CSV file for " + source + "."; return; }
    var reader = new FileReader();
    reader.onload = function () { postSeed(source, { csv: reader.result }); };
    reader.readAsText(file);
  }

  window.idxReconcile = function () {
    var s = statusEl();
    s.textContent = "Reconciling all indexed_in tags…";
    fetch("/api/indexation?action=reconcile", { method: "POST" })
      .then(r => r.json()).then(function (d) {
        if (d.error) { s.textContent = "Error: " + d.error; return; }
        var bf = d.backfill || {};
        s.textContent = "Reconciled. Tagged " + bf.tagged + " pairs (scanned " + bf.scanned + ").";
        refresh();
      }).catch(function (err) { s.textContent = "Error: " + err.message; });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", refresh);
  } else {
    refresh();
  }
})();
