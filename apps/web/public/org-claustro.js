// Organization page — Claustro classification tab. Self-contained: fetches the
// tenant claustro (núcleo academics) + program validation, renders the program
// cards and roster table, and lets editors edit the accepted indices. Lazy:
// data loads the first time the Claustro tab is opened.
(function () {
  var EDITOR = ["secretary", "director", "admin", "superadmin"];
  var ALL_INDICES = ["WoS", "Scopus", "SciELO", "DOAJ"];
  var PROGRAM_LABELS = {
    doctorado: "Doctorado",
    magister_academico: "Magíster Académico",
    magister_profesional: "Magíster Profesional",
  };
  var state = { me: null, indices: [], loaded: false };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[c];
  }); }
  function isEditor() { return state.me && (EDITOR.indexOf(state.me.role) !== -1 || state.me.tenantAdmin === true); }
  function fmtPct(p) { return (Math.round(p * 1000) / 10) + "%"; }
  function fmtHours(h) { return (Math.round(h * 10) / 10) + "h"; }
  function meetIcon(ok) { return ok ? '<span class="ok">✓</span>' : '<span class="bad">✗</span>'; }
  function chip(active, cls, txt, tip) {
    var c = active ? cls : "chip-off";
    var title = tip ? ' title="' + esc(tip) + '"' : "";
    return '<span class="chip ' + c + '"' + title + ">" + esc(txt) + "</span>";
  }

  function renderProgramCards(programs) {
    var target = document.getElementById("oc-program-cards");
    if (!target) return;
    var html = "";
    var keys = ["doctorado", "magister_academico", "magister_profesional"];
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var p = programs[k] || {};
      html += '<div class="program-card"><h4>' + esc(PROGRAM_LABELS[k] || k) + "</h4>";
      html += '<div class="pgm-row"><span>Núcleo</span><span>' + (p.total || 0) + "</span></div>";
      html += '<div class="pgm-row"><span>Calificados</span><span>' + (p.qualified || 0) + "</span></div>";
      html += '<div class="pgm-row"><span>% calificados</span><span>' + fmtPct(p.percentQualified || 0) + " " + meetIcon(p.meetsPercent) + "</span></div>";
      html += '<div class="pgm-row"><span>Mín requerido</span><span>' + (p.minRequired || 0) + " " + meetIcon(p.meetsCount) + "</span></div>";
      html += '<div class="pgm-row"><span>Promedio horas</span><span>' + fmtHours(p.averageHours || 0) + " " + meetIcon(p.meetsHours) + "</span></div>";
      html += '<div class="pgm-banner ' + (p.pass ? "pgm-pass" : "pgm-fail") + '">' + (p.pass ? "Cumple" : "No cumple") + "</div>";
      html += "</div>";
    }
    target.innerHTML = html;
  }

  function renderClaustroTable(rows) {
    var wrap = document.getElementById("oc-claustro-table");
    if (!rows || !rows.length) {
      wrap.innerHTML = '<p style="color:var(--fg-dim);font-size:12px;">Sin académicos en el núcleo.</p>';
      return;
    }
    var html = '<table class="claustro-table"><tr><th>Académico</th><th>Grado</th><th>Horas</th><th>Pubs 5a</th><th>Proy IR ext</th><th>Proy total</th><th>Clasificación</th></tr>';
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i]; var u = r.user || {}; var c = r.classification || {}; var rs = r.reasons || {}; var ev = r.evidence || {};
      html += "<tr><td><strong>" + esc(u.full_name || u.username || "—") + "</strong>";
      if (u.position || u.faculty) html += '<div style="font-size:11px;color:var(--fg-dim);">' + esc([u.position, u.faculty].filter(Boolean).join(" · ")) + "</div>";
      if (u.orcid) html += '<div style="font-size:10px;color:var(--fg-dim);font-family:var(--mono);">' + esc(u.orcid) + "</div>";
      html += "</td><td>" + esc(u.grado_academico || "—") + "</td>";
      html += "<td>" + (u.horas_permanencia != null ? esc(u.horas_permanencia) + "h" : "—") + "</td>";
      html += "<td>" + (ev.pubCount || 0) + "</td><td>" + (ev.irExterno || 0) + "</td><td>" + (ev.concursableAny || 0) + "</td>";
      html += "<td>" + chip(c.doctorado, "chip-doc", "Doctorado", rs.doctorado);
      html += chip(c.magister_academico, "chip-mac", "Mag. Acad.", rs.magister_academico);
      html += chip(c.magister_profesional, "chip-mpr", "Mag. Prof.", rs.magister_profesional);
      html += "</td></tr>";
    }
    wrap.innerHTML = html + "</table>";
  }

  function renderIndicesChecks() {
    var html = "";
    for (var i = 0; i < ALL_INDICES.length; i++) {
      var src = ALL_INDICES[i];
      var checked = state.indices.indexOf(src) !== -1 ? "checked" : "";
      var disabled = isEditor() ? "" : "disabled";
      html += '<label><input type="checkbox" data-src="' + esc(src) + '" ' + checked + " " + disabled + ">" + esc(src) + "</label>";
    }
    document.getElementById("oc-indices-checks").innerHTML = html;
  }

  function loadIndices() {
    return fetch("/api/claustro?action=indices").then(function (r) { return r.json(); }).then(function (d) {
      state.indices = (d && d.indices) || [];
      renderIndicesChecks();
    }).catch(function (e) { console.error("loadIndices failed", e); });
  }
  function loadClaustro() {
    return fetch("/api/claustro?action=validate-all").then(function (r) { return r.json(); }).then(function (d) {
      renderProgramCards(d.programs || {});
      renderClaustroTable(d.claustro || []);
    }).catch(function (e) { console.error("loadClaustro failed", e); });
  }
  function saveIndices() {
    var checks = document.querySelectorAll('#oc-indices-checks input[type="checkbox"]');
    var sel = [];
    for (var i = 0; i < checks.length; i++) if (checks[i].checked) sel.push(checks[i].dataset.src);
    fetch("/api/claustro?action=indices", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ indices: sel }),
    }).then(function (r) { return r.json(); }).then(function () { loadIndices().then(loadClaustro); });
  }

  function loadClassification() {
    if (state.loaded) return;
    state.loaded = true;
    fetch("/api/auth?action=me").then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      state.me = d;
      document.getElementById("oc-save-indices").style.display = isEditor() ? "inline-block" : "none";
      loadIndices().then(loadClaustro);
    });
  }

  function switchTab(name) {
    document.getElementById("btn-org-organigrama").classList.toggle("active", name === "organigrama");
    document.getElementById("btn-org-claustro").classList.toggle("active", name === "claustro");
    document.getElementById("tab-organigrama").hidden = name !== "organigrama";
    document.getElementById("tab-claustro").hidden = name !== "claustro";
    if (name === "claustro") loadClassification();
  }

  function init() {
    document.getElementById("btn-org-organigrama").addEventListener("click", function () { switchTab("organigrama"); });
    document.getElementById("btn-org-claustro").addEventListener("click", function () { switchTab("claustro"); });
    document.getElementById("oc-save-indices").addEventListener("click", saveIndices);
    if (window.location.hash === "#claustro") switchTab("claustro");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
