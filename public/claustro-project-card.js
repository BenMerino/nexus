(function () {
  var esc = function (s) { return window.claustroEsc(s); };

  function fmtMonto(n) {
    if (!n) return null;
    var num = Number(n);
    if (!Number.isFinite(num)) return null;
    return "$" + num.toLocaleString("es-CL");
  }

  function fmtDateRange(inicio, fin) {
    if (!inicio && !fin) return null;
    var i = inicio ? String(inicio).slice(0, 10) : "?";
    var f = fin ? String(fin).slice(0, 10) : "?";
    return i + " → " + f;
  }

  function pill(cls, text) {
    return '<span class="proj-pill ' + cls + '">' + esc(text) + "</span>";
  }

  function renderInvestigatorRow(inv) {
    var rolCls = inv.rol === "IR" ? "IR" : "CO";
    var rolLabel = inv.rol === "IR" ? "IR" : "CO";
    var orcidPart = inv.orcid ? '<span class="proj-inv-orcid">' + esc(inv.orcid) + "</span>" : "";
    var unmatched = !inv.user_id ? '<span class="proj-inv-unmatched" title="Sin match con un usuario del tenant">SIN MATCH</span>' : "";
    return '<div class="proj-inv-row">' +
      '<span class="proj-inv-rol ' + rolCls + '">' + rolLabel + "</span>" +
      '<span class="proj-inv-name">' + esc(inv.full_name) + "</span>" +
      orcidPart + unmatched + "</div>";
  }

  function render(p, editingId) {
    var editing = editingId === p.id;
    var html = '<article class="proj-card' + (editing ? " editing" : "") + '" data-id="' + p.id + '">';
    html += '<div class="proj-card-head"><div>';
    html += '<h3 class="proj-card-title">' + esc(p.titulo);
    if (p.codigo) html += '<span class="proj-card-code">' + esc(p.codigo) + "</span>";
    html += "</h3></div>";
    html += '<div class="proj-card-actions">';
    html += '<button class="proj-icon-btn" onclick="claustroEdit(' + p.id + ')" title="Editar">Editar</button>';
    html += '<button class="proj-icon-btn danger" onclick="claustroDelete(' + p.id + ')" title="Eliminar">Eliminar</button>';
    html += "</div></div>";

    html += '<div class="proj-meta">';
    if (p.fuente_financiamiento) html += pill("fund", p.fuente_financiamiento);
    if (p.concursable && p.externo) html += pill("ext", "Concursable externo");
    else if (p.concursable && !p.externo) html += pill("int", "Concursable interno");
    else if (!p.concursable) html += pill("int", "No concursable");
    var dates = fmtDateRange(p.fecha_inicio, p.fecha_fin);
    if (dates) html += pill("dates", dates);
    if (p.departamento) html += pill("dept", p.departamento);
    var monto = fmtMonto(p.monto);
    if (monto) html += pill("amount", monto);
    html += "</div>";

    var invs = p.investigators || [];
    if (invs.length) {
      var ir = invs.filter(function (x) { return x.rol === "IR"; });
      var co = invs.filter(function (x) { return x.rol === "CO"; });
      html += '<div class="proj-investigators">';
      for (var i = 0; i < ir.length; i++) html += renderInvestigatorRow(ir[i]);
      for (var j = 0; j < co.length; j++) html += renderInvestigatorRow(co[j]);
      html += "</div>";
    }

    if (p.notas) html += '<div class="proj-notes">' + esc(p.notas) + "</div>";
    html += "</article>";
    return html;
  }

  window.claustroProjectCard = { render: render };
})();
