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
    if (!rows.length) { document.getElementById("projects-list").innerHTML = '<p style="color:var(--fg-dim);font-size:12px;">Sin proyectos.</p>'; return; }
    var html = '<table class="claustro-table"><tr><th>Título</th><th>Fondo</th><th>Tipo</th><th>Vigencia</th><th>IR</th><th>Co</th><th></th></tr>';
    for (var i = 0; i < rows.length; i++) {
      var p = rows[i];
      var ir = (p.investigators || []).filter(function (x) { return x.rol === "IR"; }).map(function (x) { return x.full_name; }).join(", ");
      var co = (p.investigators || []).filter(function (x) { return x.rol === "CO"; }).map(function (x) { return x.full_name; }).join(", ");
      var tipo = (p.concursable ? "Concursable" : "No concursable") + (p.externo ? " ext" : " int");
      var vig = (p.fecha_inicio || "—") + " → " + (p.fecha_fin || "—");
      html += "<tr" + (editingId === p.id ? ' style="background:var(--bg-inset);"' : "") + ">";
      html += "<td><strong>" + esc(p.titulo) + "</strong>";
      if (p.codigo) html += ' <span style="font-family:var(--mono);font-size:10px;color:var(--fg-dim);">[' + esc(p.codigo) + "]</span>";
      if (p.departamento) html += '<div style="font-size:11px;color:var(--fg-dim);">' + esc(p.departamento) + "</div>";
      html += "</td><td>" + esc(p.fuente_financiamiento || "—");
      if (p.monto) html += '<div style="font-size:10px;color:var(--fg-dim);">$' + esc(p.monto) + "</div>";
      html += "</td><td>" + esc(tipo) + "</td><td>" + esc(vig) + "</td><td>" + esc(ir || "—") + "</td><td>" + esc(co || "—") + "</td>";
      html += '<td><button class="link-btn" onclick="claustroEdit(' + p.id + ')">Editar</button> · <button class="link-btn" onclick="claustroDelete(' + p.id + ')">Borrar</button></td>';
      html += "</tr>";
    }
    html += "</table>";
    document.getElementById("projects-list").innerHTML = html;
  }

  window.claustroRender = {
    programCards: renderProgramCards,
    claustroTable: renderClaustroTable,
    projectsList: renderProjectsList,
    projectForm: function (p) { return window.claustroForm.renderProjectForm(p); },
    collectForm: function () { return window.claustroForm.collectForm(); },
  };
})();
