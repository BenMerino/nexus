(function () {
  var esc = function (s) { return window.claustroEsc(s); };
  var fmtCLP = function (n) { return window.fmtCLP(n); };

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
    html += '<div><span>Facultad</span><span>' + esc(p.departamento || "—") + "</span></div>";
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
  }

  window.claustroRender = {
    projectsList: renderProjectsList,
    stats: renderStats,
    projectForm: function (p) { return window.claustroForm.renderProjectForm(p); },
    collectForm: function () { return window.claustroForm.collectForm(); },
  };
})();
