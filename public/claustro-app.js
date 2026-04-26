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
    fetch("/api/auth?action=me").then(function (r) {
      if (r.status === 401) { window.location.href = "/login.html"; return null; }
      if (!r.ok) throw new Error("auth failed: " + r.status);
      return r.json();
    }).then(function (d) {
      if (!d) return;
      state.me = d;
      gateProyectos();
      loadIndices().then(loadClaustro);
      if (isEditor()) loadProjects();
    }).catch(function (e) {
      console.error("[claustro] auth/me failed:", e);
      var noac = document.getElementById("proyectos-no-access");
      if (noac) { noac.style.display = "block"; noac.textContent = "Error de sesión. Recarga la página."; }
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

  function loadIndices() {
    return fetch("/api/claustro?action=indices").then(function (r) { return r.json(); }).then(function (d) {
      state.indices = (d && d.indices) || [];
      renderIndicesChecks();
    });
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
    fetch("/api/claustro?action=validate-all").then(function (r) { return r.json(); }).then(function (d) {
      state.claustro = d.claustro || [];
      state.programs = d.programs || {};
      window.claustroRender.programCards(state.programs);
      window.claustroRender.claustroTable(state.claustro);
    });
  }
  function loadProjects() {
    fetch("/api/projects?action=list").then(function (r) { return r.json(); }).then(function (rows) {
      state.projects = rows || [];
      window.claustroProjectsUI.renderFilters(state);
      window.claustroProjectsUI.renderListAndStats(state);
    });
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
  window.addEventListener("DOMContentLoaded", init);
})();
