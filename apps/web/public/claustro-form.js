// Project-form template (funding/faculty options, investigator rows, full form)
// for the Projects page. Was an IIFE in proyectos.html; hoisted to a re-runnable
// mount() (legacy-mount.ts contract) so spa/ProjectsPage.tsx can drive it on
// every React mount. The body only (re)assigns window.claustroForm /
// window.claustroFormTpl — idempotent registration, so mount() returns no cleanup.
export function mount() {
  var esc = function (s) { return window.claustroEsc(s); };
  var fmtCLP = function (n) { return window.fmtCLP(n); };

  var FACULTADES = [
    "Faculty of Agricultural Sciences",
    "Faculty of Architecture, Music and Design",
    "Faculty of Economics and Business",
    "Faculty of Education Sciences",
    "Faculty of Engineering",
    "Faculty of Legal and Social Sciences",
    "Faculty of Medicine",
    "Faculty of Dentistry",
    "Faculty of Psychology",
    "Faculty of Health Sciences",
    "Faculty of Industrial Technologies",
    "Institute of Mathematics",
    "Institute of Natural Resource Chemistry",
    "Institute of Biological Sciences",
    "Juan Ignacio Molina Institute of Humanistic Studies",
  ];

  function fundingOptions(selected) {
    var html = "";
    for (var i = 0; i < window.FUNDING_SOURCES.length; i++) {
      var f = window.FUNDING_SOURCES[i];
      var sel = f.name === selected ? " selected" : "";
      html += '<option value="' + esc(f.id) + '"' + sel + ">" + esc(f.name) + "</option>";
    }
    return html;
  }

  function facultadOptions(selected) {
    var html = '<option value="">— Select —</option>';
    var found = false;
    for (var i = 0; i < FACULTADES.length; i++) {
      var f = FACULTADES[i];
      var sel = f === selected ? " selected" : "";
      if (sel) found = true;
      html += '<option value="' + esc(f) + '"' + sel + ">" + esc(f) + "</option>";
    }
    if (selected && !found) {
      html += '<option value="' + esc(selected) + '" selected>' + esc(selected) + "</option>";
    }
    return html;
  }

  function investigatorRow(inv) {
    inv = inv || { full_name: "", orcid: "", rol: "CO" };
    var isIR = inv.rol === "IR";
    return '<div class="investigator-row">' +
      '<input class="form-input inv-name" placeholder="Full name" value="' + esc(inv.full_name) + '">' +
      '<input class="form-input mono inv-orcid" placeholder="ORCID (optional)" value="' + esc(inv.orcid || "") + '">' +
      '<button type="button" class="ir-btn' + (isIR ? " on" : "") + '" data-rol="' + (isIR ? "IR" : "CO") + '" title="Principal Investigator">PI</button>' +
      '<button type="button" class="remove-btn" title="Remove">×</button>' +
      "</div>";
  }

  function toDateInput(s) { return s ? String(s).slice(0, 10) : ""; }

  function togglePair(key, isYes) {
    return '<button type="button" class="pill' + (isYes ? " on" : "") + '" data-' + key + '="true">Yes</button>' +
           '<button type="button" class="pill' + (!isYes ? " on" : "") + '" data-' + key + '="false">No</button>';
  }

  function renderProjectForm(p) {
    p = p || {};
    var html = '<div class="form-grid">';
    html += '<div class="form-row form-row-full"><label class="form-label">Title</label>';
    html += '<input class="form-input" id="p-titulo" value="' + esc(p.titulo || "") + '" placeholder="Project title"></div>';

    html += '<div class="form-row"><label class="form-label">Funding source</label>';
    html += '<select class="form-input" id="p-funding">' + fundingOptions(p.fuente_financiamiento) + "</select></div>";

    html += '<div class="form-row"><label class="form-label">Code / ID</label>';
    html += '<input class="form-input mono" id="p-codigo" value="' + esc(p.codigo || "") + '" placeholder="1240187"></div>';

    html += '<div class="form-row"><label class="form-label">Amount (CLP)</label>';
    html += '<input class="form-input mono" id="p-monto" type="number" value="' + esc(p.monto || "") + '" placeholder="0">';
    html += '<div class="form-hint mono" id="monto-hint" style="' + (p.monto ? "" : "display:none;") + '">' + (p.monto ? esc(fmtCLP(p.monto)) : "") + "</div></div>";

    html += '<div class="form-row"><label class="form-label">Faculty</label>';
    html += '<select class="form-input" id="p-depto">' + facultadOptions(p.departamento || "") + "</select></div>";

    html += '<div class="form-row"><label class="form-label">Start date</label>';
    html += '<input class="form-input mono" id="p-inicio" type="date" value="' + esc(toDateInput(p.fecha_inicio)) + '"></div>';

    html += '<div class="form-row"><label class="form-label">End date</label>';
    html += '<input class="form-input mono" id="p-fin" type="date" value="' + esc(toDateInput(p.fecha_fin)) + '"></div>';

    html += '<div class="form-row form-row-toggle"><label class="form-label">Competitive</label>';
    html += '<div class="toggle-pair" id="t-concursable">' + togglePair("concursable", p.concursable !== false) + "</div></div>";

    html += '<div class="form-row form-row-toggle"><label class="form-label">External</label>';
    html += '<div class="toggle-pair" id="t-externo">' + togglePair("externo", p.externo !== false) + "</div></div>";

    html += '<div class="form-row form-row-full"><label class="form-label">Notes</label>';
    html += '<textarea class="form-input" id="p-notas" rows="2" placeholder="Remarks, external collaborators, etc.">' + esc(p.notas || "") + "</textarea></div>";

    html += '<div class="form-row form-row-full">';
    html += '<div class="investigators-head"><label class="form-label" style="margin:0;">Investigators</label>';
    html += '<span class="form-hint">Mark <em>PI</em> as the principal investigator. ORCID is optional but recommended.</span></div>';
    html += '<div class="investigator-list" id="inv-list">';
    var invs = (p.investigators && p.investigators.length) ? p.investigators : [{ rol: "IR", full_name: "", orcid: "" }];
    for (var i = 0; i < invs.length; i++) html += investigatorRow(invs[i]);
    html += '</div><button type="button" class="add-inv-btn" id="btn-add-inv">+ Investigator</button></div></div>';

    document.getElementById("project-form").innerHTML = html;
    window.claustroFormBind.bindEvents();
  }

  window.claustroFormTpl = { investigatorRow: investigatorRow };
  window.claustroForm = {
    renderProjectForm: renderProjectForm,
    collectForm: function () { return window.claustroFormBind.collectForm(); },
  };
}
