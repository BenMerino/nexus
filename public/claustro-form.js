(function () {
  var esc = function (s) { return window.claustroEsc(s); };

  function investigatorRow(inv) {
    inv = inv || { full_name: "", orcid: "", rol: "CO" };
    return '<div class="inv-row">' +
      '<input class="inv-name" placeholder="Nombre completo" value="' + esc(inv.full_name) + '">' +
      '<input class="inv-orcid" placeholder="ORCID (opcional)" value="' + esc(inv.orcid || "") + '">' +
      '<select class="inv-rol"><option value="IR"' + (inv.rol === "IR" ? " selected" : "") + ">IR</option><option value=\"CO\"" + (inv.rol === "CO" ? " selected" : "") + ">CO</option></select>" +
      '<button onclick="this.parentNode.remove()" title="Eliminar">×</button></div>';
  }

  function toDateInput(s) { return s ? String(s).slice(0, 10) : ""; }

  function renderProjectForm(p) {
    p = p || {};
    var rows = [
      ['<div class="form-row" style="grid-column:1/-1;"><label>Título</label><input id="p-titulo" value="' + esc(p.titulo || "") + '"></div>'],
      ['<div class="form-row"><label>Fuente financiamiento</label><input id="p-fuente" value="' + esc(p.fuente_financiamiento || "") + '" placeholder="Fondecyt Regular, CORFO, VRID..."></div>'],
      ['<div class="form-row"><label>Código / ID</label><input id="p-codigo" value="' + esc(p.codigo || "") + '"></div>'],
      ['<div class="form-row"><label>Monto (CLP)</label><input id="p-monto" type="number" value="' + esc(p.monto || "") + '"></div>'],
      ['<div class="form-row"><label>Departamento</label><input id="p-depto" value="' + esc(p.departamento || "") + '"></div>'],
      ['<div class="form-row"><label>Fecha inicio</label><input id="p-inicio" type="date" value="' + esc(toDateInput(p.fecha_inicio)) + '"></div>'],
      ['<div class="form-row"><label>Fecha fin</label><input id="p-fin" type="date" value="' + esc(toDateInput(p.fecha_fin)) + '"></div>'],
      [boolSelect("p-concursable", "Concursable", p.concursable !== false)],
      [boolSelect("p-externo", "Externo", p.externo !== false)],
      ['<div class="form-row" style="grid-column:1/-1;"><label>Notas</label><textarea id="p-notas" rows="2">' + esc(p.notas || "") + "</textarea></div>"],
    ];
    var html = '<div class="form-grid">' + rows.map(function (r) { return r[0]; }).join("") + "</div>";
    html += '<div class="form-row"><label>Investigadores</label><div id="inv-list">';
    var invs = (p.investigators && p.investigators.length) ? p.investigators : [{ rol: "IR", full_name: "", orcid: "" }];
    for (var i = 0; i < invs.length; i++) html += investigatorRow(invs[i]);
    html += '</div><button class="secondary-btn" id="btn-add-inv" type="button" style="margin-top:6px;">+ Investigador</button></div>';
    document.getElementById("project-form").innerHTML = html;
    document.getElementById("btn-add-inv").addEventListener("click", function () {
      document.getElementById("inv-list").insertAdjacentHTML("beforeend", investigatorRow(null));
    });
  }

  function boolSelect(id, label, isYes) {
    return '<div class="form-row"><label>' + label + '</label><select id="' + id + '">' +
      '<option value="true"' + (isYes ? " selected" : "") + ">Sí</option>" +
      '<option value="false"' + (!isYes ? " selected" : "") + ">No</option></select></div>";
  }

  function collectForm() {
    var get = function (id) { return document.getElementById(id).value; };
    var invRows = document.querySelectorAll(".inv-row");
    var invs = [];
    for (var i = 0; i < invRows.length; i++) {
      var name = invRows[i].querySelector(".inv-name").value.trim();
      if (!name) continue;
      invs.push({
        full_name: name,
        orcid: invRows[i].querySelector(".inv-orcid").value.trim() || null,
        rol: invRows[i].querySelector(".inv-rol").value,
      });
    }
    return {
      titulo: get("p-titulo").trim(),
      fuente_financiamiento: get("p-fuente").trim() || null,
      codigo: get("p-codigo").trim() || null,
      monto: get("p-monto") ? Number(get("p-monto")) : null,
      departamento: get("p-depto").trim() || null,
      fecha_inicio: get("p-inicio") || null,
      fecha_fin: get("p-fin") || null,
      concursable: get("p-concursable") === "true",
      externo: get("p-externo") === "true",
      notas: get("p-notas").trim() || null,
      investigators: invs,
    };
  }

  window.claustroForm = { renderProjectForm: renderProjectForm, collectForm: collectForm };
})();
