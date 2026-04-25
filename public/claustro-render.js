(function () {
  var esc = function (s) { return window.claustroEsc(s); };
  var label = function (k) { return window.claustroProgramLabel(k); };

  function fmtPct(p) { return (Math.round(p * 1000) / 10) + "%"; }
  function fmtHours(h) { return (Math.round(h * 10) / 10) + "h"; }
  function meetIcon(ok) { return ok ? '<span class="ok">✓</span>' : '<span class="bad">✗</span>'; }
  function chip(active, cls, txt, tip) {
    var c = active ? cls : "chip-off";
    var title = tip ? ' title="' + esc(tip) + '"' : "";
    return '<span class="chip ' + c + '"' + title + ">" + esc(txt) + "</span>";
  }

  function renderProgramCards(programs) {
    var html = "";
    var keys = ["doctorado", "magister_academico", "magister_profesional"];
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var p = programs[k] || {};
      html += '<div class="program-card"><h4>' + esc(label(k)) + "</h4>";
      html += '<div class="pgm-row"><span>Núcleo</span><span>' + (p.total || 0) + "</span></div>";
      html += '<div class="pgm-row"><span>Calificados</span><span>' + (p.qualified || 0) + "</span></div>";
      html += '<div class="pgm-row"><span>% calificados</span><span>' + fmtPct(p.percentQualified || 0) + " " + meetIcon(p.meetsPercent) + "</span></div>";
      html += '<div class="pgm-row"><span>Mín requerido</span><span>' + (p.minRequired || 0) + " " + meetIcon(p.meetsCount) + "</span></div>";
      html += '<div class="pgm-row"><span>Promedio horas</span><span>' + fmtHours(p.averageHours || 0) + " " + meetIcon(p.meetsHours) + "</span></div>";
      html += '<div class="pgm-banner ' + (p.pass ? "pgm-pass" : "pgm-fail") + '">' + (p.pass ? "Cumple" : "No cumple") + "</div>";
      html += "</div>";
    }
    document.getElementById("program-cards").innerHTML = html;
  }

  function renderClaustroTable(rows) {
    if (!rows || !rows.length) {
      document.getElementById("claustro-table-wrap").innerHTML = '<p style="color:var(--fg-dim);font-size:12px;">Sin académicos en el núcleo.</p>';
      return;
    }
    var html = '<table class="claustro-table"><tr><th>Académico</th><th>Grado</th><th>Horas</th><th>Pubs 5a</th><th>Proy IR ext</th><th>Proy total</th><th>Clasificación</th></tr>';
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var u = r.user || {};
      var c = r.classification || {};
      var rs = r.reasons || {};
      var ev = r.evidence || {};
      html += "<tr><td><strong>" + esc(u.full_name || u.username || "—") + "</strong>";
      if (u.position || u.faculty) html += '<div style="font-size:11px;color:var(--fg-dim);">' + esc([u.position, u.faculty].filter(Boolean).join(" · ")) + "</div>";
      if (u.orcid) html += '<div style="font-size:10px;color:var(--fg-dim);font-family:var(--mono);">' + esc(u.orcid) + "</div>";
      html += "</td><td>" + esc(u.grado_academico || "—") + "</td>";
      html += "<td>" + (u.horas_permanencia != null ? esc(u.horas_permanencia) + "h" : "—") + "</td>";
      html += "<td>" + (ev.pubCount || 0) + "</td><td>" + (ev.irExterno || 0) + "</td><td>" + (ev.concursableAny || 0) + "</td>";
      html += "<td>";
      html += chip(c.doctorado, "chip-doc", "Doctorado", rs.doctorado);
      html += chip(c.magister_academico, "chip-mac", "Mag. Acad.", rs.magister_academico);
      html += chip(c.magister_profesional, "chip-mpr", "Mag. Prof.", rs.magister_profesional);
      html += "</td></tr>";
    }
    html += "</table>";
    document.getElementById("claustro-table-wrap").innerHTML = html;
  }

  function renderProjectsList(rows, editingId) {
    var wrap = document.getElementById("projects-list");
    if (!rows.length) {
      wrap.innerHTML = '<div class="proj-empty">Aún no hay proyectos registrados. Click en <strong>+ Nuevo proyecto</strong> para empezar.</div>';
      return;
    }
    var html = "";
    for (var i = 0; i < rows.length; i++) html += window.claustroProjectCard.render(rows[i], editingId);
    wrap.innerHTML = html;
  }

  function setProjectStats(rows) {
    var total = rows.length;
    var now = new Date();
    var fiveYearsAgo = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
    var active = 0; var funding = 0;
    for (var i = 0; i < rows.length; i++) {
      var p = rows[i];
      if (p.fecha_inicio && p.fecha_fin) {
        var fi = new Date(p.fecha_inicio); var ff = new Date(p.fecha_fin);
        if (fi <= now && ff >= fiveYearsAgo) active++;
      }
      if (p.monto) funding += Number(p.monto) || 0;
    }
    document.getElementById("stat-total").textContent = total;
    document.getElementById("stat-active").textContent = active;
    document.getElementById("stat-funding").textContent = fmtCurrency(funding);
    document.getElementById("proj-count").textContent = total;
  }

  function fmtCurrency(n) {
    if (!n) return "$0";
    if (n >= 1e9) return "$" + (n / 1e9).toFixed(1) + "B";
    if (n >= 1e6) return "$" + (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return "$" + (n / 1e3).toFixed(0) + "K";
    return "$" + n;
  }

  window.claustroRender = {
    programCards: renderProgramCards,
    claustroTable: renderClaustroTable,
    projectsList: renderProjectsList,
    setProjectStats: setProjectStats,
    projectForm: function (p) { return window.claustroForm.renderProjectForm(p); },
    collectForm: function () { return window.claustroForm.collectForm(); },
  };
})();
