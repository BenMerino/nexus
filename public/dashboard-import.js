// Bulk institution import with cursor pagination (superadmin only)
var DEFAULT_ROR = "https://ror.org/03gawms58"; // UTalca

function mountImportUI() {
  var slot = document.getElementById("import-slot");
  var tpl = document.getElementById("import-template");
  if (!slot || !tpl || slot.childElementCount) return false;
  slot.appendChild(tpl.content.cloneNode(true));
  return true;
}

fetch("/api/auth?action=me").then(function (r) { return r.json(); }).then(function (d) {
  if (d.role !== "superadmin") return;
  var tries = 0;
  var iv = setInterval(function () {
    if (mountImportUI() || tries++ > 40) {
      clearInterval(iv);
      var el = document.getElementById("import-section");
      if (el) el.style.display = "";
    }
  }, 100);
});

function startImport() {
  var btn = document.getElementById("import-btn");
  var status = document.getElementById("import-status");
  var bar = document.getElementById("progress-bar");
  var fill = document.getElementById("progress-fill");
  btn.disabled = true;
  bar.style.display = "block";
  status.textContent = "Starting import...";

  var totalImported = 0;
  var totalErrors = 0;
  var cursor = "*";

  function importPage() {
    var url = "/api/dashboard?action=import&ror=" + encodeURIComponent(DEFAULT_ROR) + "&cursor=" + encodeURIComponent(cursor);
    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        totalImported += data.imported || 0;
        totalErrors += (data.errors || []).length;
        var total = data.totalCount || 1;
        var pct = Math.min(100, Math.round((totalImported / total) * 100));
        fill.style.width = pct + "%";
        status.textContent = "Imported: " + totalImported + " / ~" + total + " (" + pct + "%)";

        if (data.nextCursor && data.imported > 0) {
          cursor = data.nextCursor;
          importPage();
        } else {
          btn.disabled = false;
          status.textContent = "Done! Imported " + totalImported + " publications. " + (totalErrors ? totalErrors + " errors." : "");
          fill.style.width = "100%";
          setTimeout(function () { location.reload(); }, 1500);
        }
      })
      .catch(function (err) {
        btn.disabled = false;
        status.textContent = "Error: " + err.message;
      });
  }

  importPage();
}
