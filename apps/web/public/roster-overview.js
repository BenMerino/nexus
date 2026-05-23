// Roster overview table: lists the tenant's academics (name, department,
// faculty, ORCID status, paper count) with client-side filtering. Exposes
// window.rosterOverview.load() so roster-app.js can refresh it after an import.
(function () {
  var allAcademics = [];

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c];
    });
  }

  function load() {
    fetch("/api/auth?action=roster-list")
      .then(function (r) { return r.json(); })
      .then(function (j) {
        allAcademics = j.academics || [];
        document.getElementById("ov-total").textContent = allAcademics.length;
        document.getElementById("ov-orcid").textContent = allAcademics.filter(function (a) { return a.orcid; }).length;
        document.getElementById("ov-papers").textContent = allAcademics.filter(function (a) { return a.paper_count > 0; }).length;
        render("");
      });
  }

  function render(filter) {
    var tbody = document.getElementById("overview-tbody");
    var f = filter.toLowerCase();
    var rows = allAcademics.filter(function (a) {
      return !f || [a.full_name, a.faculty, a.department].some(function (s) { return (s || "").toLowerCase().indexOf(f) !== -1; });
    });
    document.getElementById("overview-empty").style.display = allAcademics.length ? "none" : "";
    tbody.innerHTML = "";
    rows.forEach(function (a) {
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" + esc(a.full_name) + "</td>" +
        "<td>" + esc(a.department || "—") + "</td>" +
        "<td>" + esc(a.faculty || "—") + "</td>" +
        "<td>" + (a.orcid ? '<span style="font-family:var(--mono);font-size:11px;">' + esc(a.orcid) + "</span>" : '<span class="text-muted text-small">none</span>') + "</td>" +
        "<td>" + (a.paper_count || 0) + "</td>";
      tbody.appendChild(tr);
    });
  }

  var filterInput = document.getElementById("ov-filter");
  if (filterInput) filterInput.addEventListener("input", function (e) { render(e.target.value); });

  window.rosterOverview = { load: load };
})();
