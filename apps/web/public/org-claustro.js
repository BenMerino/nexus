// Organization page — Faculty (claustro) classification tab. Self-contained:
// fetches the tenant core faculty + program validation and renders the program
// cards and roster table. The accepted-indices config that drives this
// classification is edited on the Settings page. Lazy: data loads the first
// time the Faculty tab is opened.
(function () {
  var PROGRAM_LABELS = {
    doctorado: "Doctorate",
    magister_academico: "Academic Master's",
    magister_profesional: "Professional Master's",
  };
  var state = { loaded: false };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[c];
  }); }
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
      html += '<div class="pgm-row"><span>Core</span><span>' + (p.total || 0) + "</span></div>";
      html += '<div class="pgm-row"><span>Qualified</span><span>' + (p.qualified || 0) + "</span></div>";
      html += '<div class="pgm-row"><span>% qualified</span><span>' + fmtPct(p.percentQualified || 0) + " " + meetIcon(p.meetsPercent) + "</span></div>";
      html += '<div class="pgm-row"><span>Min. required</span><span>' + (p.minRequired || 0) + " " + meetIcon(p.meetsCount) + "</span></div>";
      html += '<div class="pgm-row"><span>Avg. hours</span><span>' + fmtHours(p.averageHours || 0) + " " + meetIcon(p.meetsHours) + "</span></div>";
      html += '<div class="pgm-banner ' + (p.pass ? "pgm-pass" : "pgm-fail") + '">' + (p.pass ? "Meets" : "Doesn't meet") + "</div>";
      html += "</div>";
    }
    target.innerHTML = html;
  }

  function renderClaustroTable(rows) {
    var wrap = document.getElementById("oc-claustro-table");
    if (!rows || !rows.length) {
      wrap.innerHTML = '<p style="color:var(--fg-dim);font-size:12px;">No academics in the core.</p>';
      return;
    }
    var html = '<table class="claustro-table"><tr><th>Academic</th><th>Degree</th><th>Hours</th><th>Pubs 5y</th><th>Ext. PI proj.</th><th>Total proj.</th><th>Classification</th></tr>';
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i]; var u = r.user || {}; var c = r.classification || {}; var rs = r.reasons || {}; var ev = r.evidence || {};
      html += "<tr><td><strong>" + esc(u.full_name || u.username || "—") + "</strong>";
      if (u.position || u.faculty) html += '<div style="font-size:11px;color:var(--fg-dim);">' + esc([u.position, u.faculty].filter(Boolean).join(" · ")) + "</div>";
      if (u.orcid) html += '<div style="font-size:10px;color:var(--fg-dim);font-family:var(--mono);">' + esc(u.orcid) + "</div>";
      html += "</td><td>" + esc(u.grado_academico || "—") + "</td>";
      html += "<td>" + (u.horas_permanencia != null ? esc(u.horas_permanencia) + "h" : "—") + "</td>";
      html += "<td>" + (ev.pubCount || 0) + "</td><td>" + (ev.irExterno || 0) + "</td><td>" + (ev.concursableAny || 0) + "</td>";
      html += "<td>" + chip(c.doctorado, "chip-doc", "Doctorate", rs.doctorado);
      html += chip(c.magister_academico, "chip-mac", "Acad. Master's", rs.magister_academico);
      html += chip(c.magister_profesional, "chip-mpr", "Prof. Master's", rs.magister_profesional);
      html += "</td></tr>";
    }
    wrap.innerHTML = html + "</table>";
  }

  function loadClaustro() {
    return fetch("/api/claustro?action=validate-all").then(function (r) { return r.json(); }).then(function (d) {
      renderProgramCards(d.programs || {});
      renderClaustroTable(d.claustro || []);
    }).catch(function (e) { console.error("loadClaustro failed", e); });
  }

  function loadClassification() {
    if (state.loaded) return;
    state.loaded = true;
    loadClaustro();
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
    if (window.location.hash === "#claustro") switchTab("claustro");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
