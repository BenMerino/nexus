(function () {
  var esc = function (s) { return window.claustroEsc(s); };
  var fmtCLP = function (n) { return window.fmtCLP(n); };

  function fundingOptions(selected) {
    var html = "";
    for (var i = 0; i < window.FUNDING_SOURCES.length; i++) {
      var f = window.FUNDING_SOURCES[i];
      var sel = f.name === selected ? " selected" : "";
      html += '<option value="' + esc(f.id) + '"' + sel + ">" + esc(f.name) + "</option>";
    }
    return html;
  }

  function investigatorRow(inv) {
    inv = inv || { full_name: "", orcid: "", rol: "CO" };
    var isIR = inv.rol === "IR";
    return '<div class="investigator-row">' +
      '<input class="form-input inv-name" placeholder="Nombre completo" value="' + esc(inv.full_name) + '">' +
      '<input class="form-input mono inv-orcid" placeholder="ORCID (opcional)" value="' + esc(inv.orcid || "") + '">' +
      '<button type="button" class="ir-btn' + (isIR ? " on" : "") + '" data-rol="' + (isIR ? "IR" : "CO") + '" title="Investigador Responsable">IR</button>' +
      '<button type="button" class="remove-btn" title="Quitar">×</button>' +
      "</div>";
  }

  function toDateInput(s) { return s ? String(s).slice(0, 10) : ""; }

  function togglePair(key, isYes) {
    return '<button type="button" class="pill' + (isYes ? " on" : "") + '" data-' + key + '="true">Sí</button>' +
           '<button type="button" class="pill' + (!isYes ? " on" : "") + '" data-' + key + '="false">No</button>';
  }

  function renderProjectForm(p) {
    p = p || {};
    var html = '<div class="form-grid">';
    html += '<div class="form-row form-row-full"><label class="form-label">Título</label>';
    html += '<input class="form-input" id="p-titulo" value="' + esc(p.titulo || "") + '" placeholder="Título del proyecto"></div>';

    html += '<div class="form-row"><label class="form-label">Fuente de financiamiento</label>';
    html += '<select class="form-input" id="p-funding">' + fundingOptions(p.fuente_financiamiento) + "</select></div>";

    html += '<div class="form-row"><label class="form-label">Código / ID</label>';
    html += '<input class="form-input mono" id="p-codigo" value="' + esc(p.codigo || "") + '" placeholder="1240187"></div>';

    html += '<div class="form-row"><label class="form-label">Monto (CLP)</label>';
    html += '<input class="form-input mono" id="p-monto" type="number" value="' + esc(p.monto || "") + '" placeholder="0">';
    html += '<div class="form-hint mono" id="monto-hint" style="' + (p.monto ? "" : "display:none;") + '">' + (p.monto ? esc(fmtCLP(p.monto)) : "") + "</div></div>";

    html += '<div class="form-row"><label class="form-label">Facultad</label>';
    html += '<input class="form-input" id="p-depto" value="' + esc(p.departamento || "") + '" placeholder="Ingeniería, Ciencias..."></div>';

    html += '<div class="form-row"><label class="form-label">Fecha inicio</label>';
    html += '<input class="form-input mono" id="p-inicio" type="date" value="' + esc(toDateInput(p.fecha_inicio)) + '"></div>';

    html += '<div class="form-row"><label class="form-label">Fecha fin</label>';
    html += '<input class="form-input mono" id="p-fin" type="date" value="' + esc(toDateInput(p.fecha_fin)) + '"></div>';

    html += '<div class="form-row form-row-toggle"><label class="form-label">Concursable</label>';
    html += '<div class="toggle-pair" id="t-concursable">' + togglePair("concursable", p.concursable !== false) + "</div></div>";

    html += '<div class="form-row form-row-toggle"><label class="form-label">Externo</label>';
    html += '<div class="toggle-pair" id="t-externo">' + togglePair("externo", p.externo !== false) + "</div></div>";

    html += '<div class="form-row form-row-full"><label class="form-label">Notas</label>';
    html += '<textarea class="form-input" id="p-notas" rows="2" placeholder="Observaciones, colaboradores externos, etc.">' + esc(p.notas || "") + "</textarea></div>";

    html += '<div class="form-row form-row-full">';
    html += '<div class="investigators-head"><label class="form-label" style="margin:0;">Investigadores</label>';
    html += '<span class="form-hint">Marca <em>IR</em> al investigador responsable. ORCID es opcional pero recomendado.</span></div>';
    html += '<div class="investigator-list" id="inv-list">';
    var invs = (p.investigators && p.investigators.length) ? p.investigators : [{ rol: "IR", full_name: "", orcid: "" }];
    for (var i = 0; i < invs.length; i++) html += investigatorRow(invs[i]);
    html += '</div><button type="button" class="add-inv-btn" id="btn-add-inv">+ Investigador</button></div></div>';

    document.getElementById("project-form").innerHTML = html;
    window.claustroFormBind.bindEvents();
  }

  window.claustroFormTpl = { investigatorRow: investigatorRow };
  window.claustroForm = {
    renderProjectForm: renderProjectForm,
    collectForm: function () { return window.claustroFormBind.collectForm(); },
  };
})();
