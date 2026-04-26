(function () {
  var state = {
    me: null, claustro: null, programs: null, projects: [],
    allIndices: ["WoS","Scopus","SciELO","DOAJ"], indices: [],
    editingId: null, formOpen: false, deptFilter: "all",
  };
  var EDITOR = ["secretary","director","admin","superadmin"];
  var PROGRAM_LABELS = {
    doctorado: "Doctorado",
    magister_academico: "Magíster Académico",
    magister_profesional: "Magíster Profesional",
  };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" })[c];
  }); }
  function isEditor() { return state.me && EDITOR.indexOf(state.me.role) !== -1; }

  function bind(id, evt, fn) {
    var el = document.getElementById(id);
    if (!el) { console.warn("[claustro] missing #" + id + " — stale HTML cache?"); return; }
    el.addEventListener(evt, fn);
  }
  var showError = function (m) { return window.claustroErr.showError(m); };
  var safeFetch = function (u, o) { return window.claustroErr.safeFetch(u, o); };
  function init() {
    bind("btn-tab-proyectos", "click", function () { switchTab("proyectos"); });
    bind("btn-tab-clasificacion", "click", function () { switchTab("clasificacion"); });
    bind("btn-save-indices", "click", saveIndices);
    bind("btn-toggle-form", "click", function () {
      if (state.formOpen) window.claustroProjectsUI.closeForm(state);
      else window.claustroProjectsUI.openNewForm(state);
    });
    bind("btn-save-project", "click", saveProject);
    bind("btn-cancel-project", "click", function () { window.claustroProjectsUI.closeForm(state); });
    // Optimistic load: assume editor, fire all fetches in parallel. If /me
    // confirms non-editor, hide the area then. If anything 401s, redirect.
    loadProjects();
    safeFetch("/api/auth?action=me").then(function (d) {
      state.me = d;
      gateProyectos();
      loadIndices().then(loadClaustro);
    }).catch(function (e) {
      if (String(e.message) === "401") return;
      console.error("[claustro] auth/me failed:", e);
      showError("Error de sesión: " + e.message + ". Recarga la página.");
    });
  }
  function switchTab(name) {
    document.getElementById("btn-tab-proyectos").classList.toggle("active", name === "proyectos");
    document.getElementById("btn-tab-clasificacion").classList.toggle("active", name === "clasificacion");
    document.getElementById("tab-proyectos").hidden = name !== "proyectos";
    document.getElementById("tab-clasificacion").hidden = name !== "clasificacion";
  }
  function gateProyectos() {
    var ed = isEditor();
    var area = document.getElementById("proyectos-area");
    var noac = document.getElementById("proyectos-no-access");
    var save = document.getElementById("btn-save-indices");
    if (area) area.style.display = ed ? "block" : "none";
    if (noac) noac.style.display = ed ? "none" : "block";
    if (save) save.style.display = ed ? "inline-block" : "none";
  }
  var logFetchErr = function (l) { return window.claustroErr.logFetchErr(l); };

  function loadIndices() {
    return safeFetch("/api/claustro?action=indices").then(function (d) {
      state.indices = (d && d.indices) || [];
      renderIndicesChecks();
    }).catch(logFetchErr("indices"));
  }
  function renderIndicesChecks() {
    var html = "";
    for (var i = 0; i < state.allIndices.length; i++) {
      var src = state.allIndices[i];
      var checked = state.indices.indexOf(src) !== -1 ? "checked" : "";
      var disabled = isEditor() ? "" : "disabled";
      html += '<label><input type="checkbox" data-src="' + esc(src) + '" ' + checked + " " + disabled + ">" + esc(src) + "</label>";
    }
    document.getElementById("indices-checks").innerHTML = html;
  }
  function saveIndices() {
    var checks = document.querySelectorAll('#indices-checks input[type="checkbox"]');
    var sel = [];
    for (var i = 0; i < checks.length; i++) if (checks[i].checked) sel.push(checks[i].dataset.src);
    fetch("/api/claustro?action=indices", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ indices: sel }),
    }).then(function (r) { return r.json(); }).then(function () { loadIndices().then(loadClaustro); });
  }

  function loadClaustro() {
    safeFetch("/api/claustro?action=validate-all").then(function (d) {
      state.claustro = d.claustro || [];
      state.programs = d.programs || {};
      window.claustroRender.programCards(state.programs);
      window.claustroRender.claustroTable(state.claustro);
    }).catch(logFetchErr("validate-all"));
  }
  function loadProjects() {
    safeFetch("/api/projects?action=list").then(function (rows) {
      state.projects = rows || [];
      window.claustroProjectsUI.renderFilters(state);
      window.claustroProjectsUI.renderListAndStats(state);
    }).catch(logFetchErr("projects"));
  }

  function saveProject() {
    var body = window.claustroRender.collectForm();
    if (!body.titulo) { alert("Título requerido"); return; }
    var url, method;
    if (state.editingId) { url = "/api/projects?action=update"; method = "PUT"; body.id = state.editingId; }
    else { url = "/api/projects?action=create"; method = "POST"; }
    fetch(url, { method: method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.error) { alert(d.error); return; }
        window.claustroProjectsUI.closeForm(state);
        loadProjects(); loadClaustro();
      });
  }
  window.claustroEdit = function (id) {
    fetch("/api/projects?action=get&id=" + id).then(function (r) { return r.json(); }).then(function (p) {
      window.claustroProjectsUI.openEditForm(state, p);
    });
  };
  window.claustroDelete = function (id) {
    if (!confirm("¿Eliminar proyecto #" + id + "?")) return;
    fetch("/api/projects?action=delete&id=" + id, { method: "DELETE" })
      .then(function (r) { return r.json(); })
      .then(function () {
        if (state.editingId === id) window.claustroProjectsUI.closeForm(state);
        loadProjects(); loadClaustro();
      });
  };
  window.claustroProgramLabel = function (k) { return PROGRAM_LABELS[k] || k; };
  window.claustroEsc = esc;
  window.claustroState = state;
  var booted = false;
  function boot() { if (booted) return; booted = true; init(); }
  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
  // bfcache restore: page comes back without DOMContentLoaded firing.
  // Re-fetch fresh data so the UI matches current server state.
  window.addEventListener("pageshow", function (e) {
    if (e.persisted) { booted = true; loadProjects(); loadClaustro(); }
  });
})();
