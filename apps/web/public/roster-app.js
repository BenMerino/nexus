// Roster page: tenant-admin uploads a faculty roster CSV; each row becomes an
// academic user under the tenant. Gated client-side on tenantAdmin (the API
// re-enforces it). Surfaces generated temp credentials once, as a download.
(function () {
  var tenantId = null;

  fetch("/api/auth?action=me").then(function (r) { return r.json(); }).then(function (d) {
    tenantId = d.tenantId;
    var allowed = d.tenantAdmin === true || d.role === "superadmin";
    document.getElementById(allowed ? "roster-card" : "roster-noaccess").style.display = "";
  });

  var fileInput = document.getElementById("roster-file");
  var textArea = document.getElementById("roster-text");
  fileInput.addEventListener("change", function (e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () { textArea.value = reader.result; };
    reader.readAsText(file);
  });

  document.getElementById("roster-import-btn").addEventListener("click", runImport);

  function runImport() {
    var csv = textArea.value.trim();
    var status = document.getElementById("roster-status");
    if (!csv) { status.textContent = "Paste or choose a CSV first."; return; }
    status.textContent = "Importing…";

    fetch("/api/auth?action=users-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv: csv, tenant_id: tenantId }),
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok) { status.textContent = res.j.error || "Import failed."; return; }
        status.textContent = "Done.";
        showResult(res.j);
      })
      .catch(function (err) { status.textContent = "Error: " + err.message; });
  }

  function showResult(j) {
    document.getElementById("roster-result").style.display = "";
    document.getElementById("stat-parsed").textContent = j.parsed || 0;
    document.getElementById("stat-created").textContent = j.created || 0;
    document.getElementById("stat-updated").textContent = j.updated || 0;
    document.getElementById("stat-errors").textContent = (j.errors && j.errors.length) || 0;

    var creds = document.getElementById("roster-creds");
    creds.innerHTML = "";
    if (j.credentials && j.credentials.length) {
      var blob = new Blob(
        [j.credentials.map(function (c) { return c.username + "," + c.password + "," + c.fullName; }).join("\n")],
        { type: "text/csv" }
      );
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "roster-credentials.csv";
      a.className = "primary-btn";
      a.textContent = "Download " + j.credentials.length + " credentials (CSV)";
      creds.appendChild(a);
      var note = document.createElement("div");
      note.className = "text-small mt-8";
      note.textContent = "These temporary passwords are shown only once. Download and distribute them now.";
      creds.appendChild(note);
    }

    var errList = document.getElementById("roster-errlist");
    errList.innerHTML = "";
    if (j.errors && j.errors.length) {
      errList.textContent = j.errors.slice(0, 20).map(function (e) {
        return e.fullName + ": " + e.error;
      }).join("\n");
    }
  }
})();
