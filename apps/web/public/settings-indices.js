// Settings — accepted citation indices for the claustro classification.
// Visible to editors (secretary/director/admin/superadmin) and tenant_admins,
// matching the requireEditor gate on PUT /api/claustro?action=indices.
(function () {
  var EDITOR = ["secretary", "director", "admin", "superadmin"];
  var ALL = ["WoS", "Scopus", "SciELO", "DOAJ"];
  var selected = [];

  function isEditor(me) { return me && (EDITOR.indexOf(me.role) !== -1 || me.tenantAdmin === true); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[c];
  }); }

  function render() {
    var html = "";
    for (var i = 0; i < ALL.length; i++) {
      var src = ALL[i];
      var checked = selected.indexOf(src) !== -1 ? "checked" : "";
      html += '<label><input type="checkbox" data-src="' + esc(src) + '" ' + checked + ">" + esc(src) + "</label>";
    }
    document.getElementById("idx-checks").innerHTML = html;
  }

  function loadIndices() {
    return fetch("/api/claustro?action=indices").then(function (r) { return r.json(); }).then(function (d) {
      selected = (d && d.indices) || [];
      render();
    }).catch(function (e) { console.error("loadIndices failed", e); });
  }

  function save() {
    var checks = document.querySelectorAll('#idx-checks input[type="checkbox"]');
    var sel = [];
    for (var i = 0; i < checks.length; i++) if (checks[i].checked) sel.push(checks[i].dataset.src);
    var status = document.getElementById("idx-status");
    status.textContent = "Saving…";
    fetch("/api/claustro?action=indices", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ indices: sel }),
    }).then(function (r) { return r.json(); }).then(function (d) {
      status.textContent = d.error ? d.error : "Saved!";
      if (!d.error) selected = d.indices || sel;
      setTimeout(function () { status.textContent = ""; }, 2000);
    }).catch(function (err) { status.textContent = err.message; });
  }

  fetch("/api/auth?action=me").then(function (r) { return r.ok ? r.json() : null; }).then(function (me) {
    if (!isEditor(me)) return;
    document.getElementById("indices-card").style.display = "";
    document.getElementById("idx-save").addEventListener("click", save);
    loadIndices();
  });
})();
