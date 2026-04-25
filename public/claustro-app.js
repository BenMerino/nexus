(function () {
  var state = { me: null, claustro: null, programs: null, allIndices: ["WoS","Scopus","SciELO","DOAJ"], indices: [], editingId: null };
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
    document.getElementById("btn-cancel-project").addEventListener("click", cancelEdit);
    fetch("/api/auth?action=me").then(function (r) { return r.json(); }).then(function (d) {
      state.me = d;
      gateProyectos();
      loadIndices().then(loadClaustro);
      if (isEditor()) loadProjects();
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
      html += '<label style="display:inline-flex;gap:4px;align-items:center;font-family:var(--mono);font-size:11px;">';
      html += '<input type="checkbox" data-src="' + esc(src) + '" ' + checked + " " + disabled + ">" + esc(src);
      html += "</label>";
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
      window.claustroRender.projectsList(rows || [], state.editingId);
    });
    if (!state.editingId) window.claustroRender.projectForm(null);
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
        state.editingId = null;
        document.getElementById("btn-cancel-project").style.display = "none";
        document.getElementById("proj-form-title").textContent = "Nuevo proyecto";
        loadProjects();
        loadClaustro();
      });
  }
  function cancelEdit() {
    state.editingId = null;
    document.getElementById("btn-cancel-project").style.display = "none";
    document.getElementById("proj-form-title").textContent = "Nuevo proyecto";
    window.claustroRender.projectForm(null);
  }
  window.claustroEdit = function (id) {
    fetch("/api/projects?action=get&id=" + id).then(function (r) { return r.json(); }).then(function (p) {
      state.editingId = id;
      document.getElementById("btn-cancel-project").style.display = "inline-block";
      document.getElementById("proj-form-title").textContent = "Editar proyecto #" + id;
      window.claustroRender.projectForm(p);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };
  window.claustroDelete = function (id) {
    if (!confirm("¿Eliminar proyecto #" + id + "?")) return;
    fetch("/api/projects?action=delete&id=" + id, { method: "DELETE" })
      .then(function (r) { return r.json(); })
      .then(function () { loadProjects(); loadClaustro(); });
  };
  window.claustroProgramLabel = function (k) { return PROGRAM_LABELS[k] || k; };
  window.claustroEsc = esc;
  window.claustroState = state;
  window.addEventListener("DOMContentLoaded", init);
})();
