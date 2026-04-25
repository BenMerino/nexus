(function () {
  var state = { me: null, claustro: null, programs: null, projects: [], allIndices: ["WoS","Scopus","SciELO","DOAJ"], indices: [], editingId: null };
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

  function init() {
    document.getElementById("btn-tab-clasificacion").addEventListener("click", function () { switchTab("clasificacion"); });
    document.getElementById("btn-tab-proyectos").addEventListener("click", function () { switchTab("proyectos"); });
    document.getElementById("btn-save-indices").addEventListener("click", saveIndices);
    document.getElementById("btn-save-project").addEventListener("click", saveProject);
    document.getElementById("btn-cancel-project").addEventListener("click", closeForm);
    document.getElementById("btn-new-project").addEventListener("click", openNewForm);
    fetch("/api/auth?action=me").then(function (r) { return r.json(); }).then(function (d) {
      state.me = d;
      gateProyectos();
      loadIndices().then(loadClaustro);
      if (isEditor()) { loadProjects(); switchTab("proyectos"); }
    });
  }
  function switchTab(name) {
    var btnC = document.getElementById("btn-tab-clasificacion");
    var btnP = document.getElementById("btn-tab-proyectos");
    var tabC = document.getElementById("tab-clasificacion");
    var tabP = document.getElementById("tab-proyectos");
    btnC.classList.toggle("active", name === "clasificacion");
    btnP.classList.toggle("active", name === "proyectos");
    tabC.hidden = name !== "clasificacion";
    tabP.hidden = name !== "proyectos";
  }
  function gateProyectos() {
    document.getElementById("proyectos-area").style.display = isEditor() ? "block" : "none";
    document.getElementById("proyectos-no-access").style.display = isEditor() ? "none" : "block";
    document.getElementById("btn-save-indices").style.display = isEditor() ? "inline-block" : "none";
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
      window.claustroRender.projectsList(state.projects, state.editingId);
      window.claustroRender.setProjectStats(state.projects);
    });
  }

  function openNewForm() {
    state.editingId = null;
    document.getElementById("proj-form-title").textContent = "Nuevo proyecto";
    document.getElementById("proj-form-badge").textContent = "Nuevo";
    document.getElementById("form-pane").style.display = "block";
    window.claustroRender.projectForm(null);
    window.claustroRender.projectsList(state.projects, null);
    document.getElementById("form-pane").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function closeForm() {
    state.editingId = null;
    document.getElementById("form-pane").style.display = "none";
    window.claustroRender.projectsList(state.projects, null);
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
        closeForm();
        loadProjects();
        loadClaustro();
      });
  }
  window.claustroEdit = function (id) {
    fetch("/api/projects?action=get&id=" + id).then(function (r) { return r.json(); }).then(function (p) {
      state.editingId = id;
      document.getElementById("proj-form-title").textContent = "Editar proyecto";
      document.getElementById("proj-form-badge").textContent = "#" + id;
      document.getElementById("form-pane").style.display = "block";
      window.claustroRender.projectForm(p);
      window.claustroRender.projectsList(state.projects, id);
      document.getElementById("form-pane").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };
  window.claustroDelete = function (id) {
    if (!confirm("¿Eliminar proyecto #" + id + "?")) return;
    fetch("/api/projects?action=delete&id=" + id, { method: "DELETE" })
      .then(function (r) { return r.json(); })
      .then(function () { if (state.editingId === id) closeForm(); loadProjects(); loadClaustro(); });
  };
  window.claustroProgramLabel = function (k) { return PROGRAM_LABELS[k] || k; };
  window.claustroEsc = esc;
  window.claustroState = state;
  window.addEventListener("DOMContentLoaded", init);
})();
