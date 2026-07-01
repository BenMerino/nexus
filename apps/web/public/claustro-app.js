// Orchestrator for the Projects page (fetch me → gate → load projects, wire the
// header buttons). Was an IIFE in proyectos.html; hoisted to a re-runnable,
// named mount() (legacy-mount.ts contract) so spa/ProjectsPage.tsx can drive it
// on every React mount. mount() re-binds the toggle/save/cancel listeners on the
// freshly-mounted DOM, re-registers the window.claustro* globals (the ported
// card markup's inline onclick="claustroEdit/claustroDelete" resolves to them),
// and re-fetches. React discards the DOM nodes on unmount, so listeners bound
// here don't stack across remounts — no cleanup is returned.
export function mount() {
  var state = {
    me: null, projects: [],
    editingId: null, formOpen: false, deptFilter: "all",
  };
  var EDITOR = ["secretary","director","admin","superadmin"];
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" })[c];
  }); }
  function isEditor() { return state.me && (EDITOR.indexOf(state.me.role) !== -1 || state.me.tenantAdmin === true); }

  function init() {
    document.getElementById("btn-toggle-form").addEventListener("click", function () {
      if (state.formOpen) window.claustroProjectsUI.closeForm(state);
      else window.claustroProjectsUI.openNewForm(state);
    });
    document.getElementById("btn-save-project").addEventListener("click", saveProject);
    document.getElementById("btn-cancel-project").addEventListener("click", function () { window.claustroProjectsUI.closeForm(state); });
    fetch("/api/auth?action=me").then(function (r) {
      if (r.status === 401) { window.location.href = "/login.html"; return null; }
      return r.json();
    }).then(function (d) {
      if (!d) return;
      if (!d.role) { window.location.href = "/login.html"; return; }
      state.me = d;
      gateProyectos();
      if (isEditor()) loadProjects();
    });
  }
  function gateProyectos() {
    document.getElementById("proyectos-area").style.display = isEditor() ? "block" : "none";
    document.getElementById("proyectos-no-access").style.display = isEditor() ? "none" : "block";
  }

  function loadProjects() {
    return fetch("/api/projects?action=list").then(function (r) { return r.json(); }).then(function (rows) {
      state.projects = rows || [];
      window.claustroProjectsUI.renderFilters(state);
      window.claustroProjectsUI.renderListAndStats(state);
    }).catch(function (e) { console.error("loadProjects failed", e); });
  }

  function saveProject() {
    var body = window.claustroRender.collectForm();
    if (!body.titulo) { alert("Title required"); return; }
    var url, method;
    if (state.editingId) { url = "/api/projects?action=update"; method = "PUT"; body.id = state.editingId; }
    else { url = "/api/projects?action=create"; method = "POST"; }
    fetch(url, { method: method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.error) { alert(d.error); return; }
        window.claustroProjectsUI.closeForm(state);
        loadProjects();
      });
  }
  window.claustroEdit = function (id) {
    fetch("/api/projects?action=get&id=" + id).then(function (r) { return r.json(); }).then(function (p) {
      window.claustroProjectsUI.openEditForm(state, p);
    });
  };
  window.claustroDelete = function (id) {
    if (!confirm("Delete project #" + id + "?")) return;
    fetch("/api/projects?action=delete&id=" + id, { method: "DELETE" })
      .then(function (r) { return r.json(); })
      .then(function () {
        if (state.editingId === id) window.claustroProjectsUI.closeForm(state);
        loadProjects();
      });
  };
  window.claustroEsc = esc;
  window.claustroState = state;
  // useLegacyMounts invokes mount() from a useEffect, after React has committed
  // the page body — every element init() touches already exists, so call it
  // directly (no readyState gate). Registration modules (funding/render/form/…)
  // are imported alongside in the same Promise.all and register their window.*
  // globals before any mount() runs, so init()'s window.claustro* reads resolve.
  init();
}
