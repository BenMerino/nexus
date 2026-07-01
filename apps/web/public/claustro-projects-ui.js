// Filters / list / form open-close for the Projects page. Was an IIFE in
// proyectos.html; hoisted to a re-runnable mount() (legacy-mount.ts contract)
// so spa/ProjectsPage.tsx can drive it on every React mount. The body only
// (re)assigns window.claustroProjectsUI (consumed by claustro-app.js), which is
// idempotent — no per-mount DOM work here, so mount() returns no cleanup.
export function mount() {
  function esc(s) { return window.claustroEsc(s); }

  function renderFilters(state) {
    var depts = {};
    for (var i = 0; i < state.projects.length; i++) {
      var d = state.projects[i].departamento;
      if (d) depts[d] = (depts[d] || 0) + 1;
    }
    var html = '<button class="pill ' + (state.deptFilter === "all" ? "on" : "") + '" data-dept="all">All · ' + state.projects.length + "</button>";
    var keys = Object.keys(depts).sort();
    for (var j = 0; j < keys.length; j++) {
      var k = keys[j];
      html += '<button class="pill ' + (state.deptFilter === k ? "on" : "") + '" data-dept="' + esc(k) + '">' + esc(k) + " · " + depts[k] + "</button>";
    }
    var wrap = document.getElementById("filter-pills");
    wrap.innerHTML = html;
    var pills = wrap.querySelectorAll(".pill");
    for (var p = 0; p < pills.length; p++) {
      pills[p].addEventListener("click", function (e) {
        state.deptFilter = e.currentTarget.dataset.dept;
        renderFilters(state);
        renderListAndStats(state);
      });
    }
  }

  function filteredProjects(state) {
    if (state.deptFilter === "all") return state.projects;
    return state.projects.filter(function (p) { return p.departamento === state.deptFilter; });
  }

  function renderListAndStats(state) {
    var f = filteredProjects(state);
    window.claustroRender.projectsList(f, state.editingId);
    window.claustroRender.stats(state.projects);
    document.getElementById("list-count").textContent = f.length + " results";
    document.getElementById("list-title").textContent = state.deptFilter === "all" ? "All projects" : state.deptFilter;
  }

  function openNewForm(state) {
    state.editingId = null; state.formOpen = true;
    document.getElementById("proj-form-eyebrow").textContent = "New project";
    document.getElementById("project-form-card").style.display = "block";
    document.getElementById("btn-toggle-form").textContent = "Cancel";
    window.claustroRender.projectForm(null);
    document.getElementById("project-form-card").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openEditForm(state, p) {
    state.editingId = p.id; state.formOpen = true;
    document.getElementById("proj-form-eyebrow").textContent = "Edit project #" + p.id;
    document.getElementById("project-form-card").style.display = "block";
    document.getElementById("btn-toggle-form").textContent = "Cancel";
    window.claustroRender.projectForm(p);
    document.getElementById("project-form-card").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function closeForm(state) {
    state.editingId = null; state.formOpen = false;
    document.getElementById("project-form-card").style.display = "none";
    document.getElementById("btn-toggle-form").textContent = "+ New project";
    renderListAndStats(state);
  }

  window.claustroProjectsUI = {
    renderFilters: renderFilters,
    renderListAndStats: renderListAndStats,
    openNewForm: openNewForm,
    openEditForm: openEditForm,
    closeForm: closeForm,
  };
}
