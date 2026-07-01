// Roster overview table — server-paginated, mirroring Zincro's TableRender
// behavior (sortable headers with ▲/▼, search, footer count + pager) over
// Nexus's roster-list endpoint, which speaks the TableQuery/PaginatedResult
// contract. window.rosterOverview.load() refreshes after an import.
//
// SPA contract (legacy-mount.ts): mount() is re-runnable — it re-queries the
// toolbar controls and re-binds their listeners on every route entry, and
// returns a cleanup that clears the pending search-debounce timer.
export function mount() {
  var PAGE_SIZE = 25;
  var state = { page: 0, sort: "name", dir: "asc", q: "" };
  var searchTimer = null;

  var COLS = [
    { id: "name", label: "Name", field: "full_name", sortable: true },
    { id: "department", label: "Department", field: "department", sortable: true },
    { id: "faculty", label: "Faculty", field: "faculty", sortable: true },
    { id: "orcid", label: "ORCID", field: "orcid", sortable: true },
    { id: "papers", label: "Papers", field: "paper_count", sortable: true },
  ];

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c];
    });
  }

  function load() { state.page = 0; fetchPage(); }

  function fetchPage() {
    var p = new URLSearchParams({ page: state.page, pageSize: PAGE_SIZE, sort: state.sort, dir: state.dir, q: state.q });
    fetch("/api/auth?action=roster-list&" + p.toString())
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j.ok) { document.getElementById("ov-foot").textContent = j.error || "Failed to load."; return; }
        render(j);
      });
  }

  function render(j) {
    renderHead();
    var tbody = document.getElementById("overview-tbody");
    tbody.innerHTML = "";
    j.rows.forEach(function (a) {
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" + esc(a.full_name) + "</td>" +
        "<td>" + esc(a.department || "—") + "</td>" +
        "<td>" + esc(a.faculty || "—") + "</td>" +
        "<td>" + (a.orcid ? '<span style="font-family:var(--mono);font-size:11px;">' + esc(a.orcid) + "</span>" : '<span class="text-muted text-small">none</span>') + "</td>" +
        "<td>" + (a.paper_count || 0) + "</td>";
      tbody.appendChild(tr);
    });
    document.getElementById("overview-empty").style.display = j.totalCount ? "none" : "";

    var start = j.totalCount === 0 ? 0 : j.page * j.pageSize + 1;
    var end = Math.min(j.totalCount, (j.page + 1) * j.pageSize);
    document.getElementById("ov-foot").textContent = j.totalCount === 0 ? "No academics yet." : (start + "–" + end + " of " + j.totalCount);
    document.getElementById("ov-prev").disabled = j.page <= 0;
    document.getElementById("ov-next").disabled = end >= j.totalCount;
  }

  function renderHead() {
    var thead = document.getElementById("overview-thead");
    thead.innerHTML = "";
    var tr = document.createElement("tr");
    COLS.forEach(function (col) {
      var th = document.createElement("th");
      var active = state.sort === col.id;
      th.textContent = col.label + (active ? (state.dir === "asc" ? " ▲" : " ▼") : "");
      if (col.sortable) {
        th.style.cursor = "pointer";
        th.addEventListener("click", function () {
          if (state.sort === col.id) state.dir = state.dir === "asc" ? "desc" : "asc";
          else { state.sort = col.id; state.dir = "asc"; }
          state.page = 0;
          fetchPage();
        });
      }
      tr.appendChild(th);
    });
    thead.appendChild(tr);
  }

  // Wire controls (filter box reused as server search; pager buttons).
  var filterInput = document.getElementById("ov-filter");
  if (filterInput) filterInput.addEventListener("input", function (e) {
    clearTimeout(searchTimer);
    var v = e.target.value;
    searchTimer = setTimeout(function () { state.q = v; state.page = 0; fetchPage(); }, 250);
  });
  var prev = document.getElementById("ov-prev");
  var next = document.getElementById("ov-next");
  if (prev) prev.addEventListener("click", function () { if (state.page > 0) { state.page--; fetchPage(); } });
  if (next) next.addEventListener("click", function () { state.page++; fetchPage(); });

  window.rosterOverview = { load: load };

  // Clear the pending debounce so no stray fetch fires after unmount.
  return function cleanup() { clearTimeout(searchTimer); };
}
