(function () {
  var esc = function (s) { return window.claustroEsc(s); };
  var label = function (k) { return window.claustroProgramLabel(k); };
  var fmtCLP = function (n) { return window.fmtCLP(n); };

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
    document.getElementById("claustro-table-wrap").innerHTML = html + "</table>";
  }

  function renderProjectCard(p, editingId) {
    var fundingName = (p.fuente_financiamiento || "Otro");
    var ir = (p.investigators || []).filter(function (x) { return x.rol === "IR"; });
    var others = (p.investigators || []).filter(function (x) { return x.rol !== "IR"; });
    var html = '<article class="project-card' + (editingId === p.id ? " editing" : "") + '">';
    html += '<div class="project-card-top">';
    html += '<div class="project-funding mono">' + esc(fundingName) + "</div>";
    html += '<div class="project-flags">';
    if (p.concursable) html += '<span class="tag mono">CONCURSABLE</span>';
    if (p.externo) html += '<span class="tag mono tag-muted">EXTERNO</span>';
    html += '<div class="project-actions">';
    html += '<button class="project-action-btn" onclick="claustroEdit(' + p.id + ')">Editar</button>';
    html += '<button class="project-action-btn danger" onclick="claustroDelete(' + p.id + ')">Eliminar</button>';
    html += "</div></div></div>";
    html += '<h3 class="project-title">' + esc(p.titulo) + "</h3>";
    html += '<div class="project-meta">';
    html += '<div><span>Código</span><span class="mono">' + esc(p.codigo || "—") + "</span></div>";
    html += '<div><span>Monto</span><span class="mono" style="color:var(--accent);">' + esc(fmtCLP(p.monto)) + "</span></div>";
    html += '<div><span>Depto.</span><span>' + esc(p.departamento || "—") + "</span></div>";
    html += '<div><span>Periodo</span><span class="mono">' + esc((p.fecha_inicio || "?").slice(0, 10)) + " → " + esc((p.fecha_fin || "?").slice(0, 10)) + "</span></div>";
    html += "</div>";
    if (p.notas) html += '<div class="project-notes">' + esc(p.notas) + "</div>";
    html += '<div class="project-investigators">';
    for (var i = 0; i < ir.length; i++) html += renderInvLine(ir[i], "IR");
    for (var j = 0; j < others.length; j++) html += renderInvLine(others[j], "CO");
    html += "</div></article>";
    return html;
  }

  function renderInvLine(inv, rol) {
    var coClass = rol === "CO" ? " inv-co" : "";
    var roleClass = rol === "CO" ? " inv-role-co" : "";
    var unmatched = !inv.user_id ? '<span class="inv-unmatched" title="Sin match con un usuario del tenant">SIN MATCH</span>' : "";
    return '<div class="inv-line' + coClass + '">' +
      '<span class="inv-role-badge' + roleClass + '">' + rol + "</span>" +
      '<span class="inv-name">' + esc(inv.full_name) + "</span>" +
      (inv.orcid ? '<span class="inv-orcid">' + esc(inv.orcid) + "</span>" : "") +
      unmatched + "</div>";
  }

  function renderProjectsList(rows, editingId) {
    var wrap = document.getElementById("projects-list");
    if (!rows || !rows.length) {
      wrap.innerHTML = '<div class="empty-state"><div class="empty-glyph">∅</div><div class="empty-head">Sin proyectos.</div><div class="empty-sub">Aún no se han registrado proyectos en este filtro.</div></div>';
      return;
    }
    var html = '<div class="project-grid">';
    for (var i = 0; i < rows.length; i++) html += renderProjectCard(rows[i], editingId);
    wrap.innerHTML = html + "</div>";
  }

  function renderStats(rows) {
    var total = rows.length;
    var amount = 0; var conc = 0; var ext = 0;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].monto) amount += Number(rows[i].monto) || 0;
      if (rows[i].concursable) conc++;
      if (rows[i].externo) ext++;
    }
    document.getElementById("stat-total-val").textContent = total;
    document.getElementById("stat-amount-val").textContent = window.fmtCLP(amount);
    document.getElementById("stat-conc-val").textContent = conc;
    document.getElementById("stat-conc-sub").textContent = "de " + total + " proyectos";
    document.getElementById("stat-ext-val").textContent = ext;
    document.getElementById("tag-count").textContent = total + " PROYECTOS";
    document.getElementById("tag-amount").textContent = window.fmtCLP(amount);
    document.getElementById("proj-count").textContent = total;
  }

  window.claustroRender = {
    programCards: renderProgramCards,
    claustroTable: renderClaustroTable,
    projectsList: renderProjectsList,
    stats: renderStats,
    projectForm: function (p) { return window.claustroForm.renderProjectForm(p); },
    collectForm: function () { return window.claustroForm.collectForm(); },
  };
})();
