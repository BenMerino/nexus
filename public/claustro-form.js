(function () {
  var esc = function (s) { return window.claustroEsc(s); };

  function investigatorRow(inv) {
    inv = inv || { full_name: "", orcid: "", rol: "CO" };
    return '<div class="inv-row">' +
      '<select class="inv-rol"><option value="IR"' + (inv.rol === "IR" ? " selected" : "") + ">IR</option>" +
      '<option value="CO"' + (inv.rol !== "IR" ? " selected" : "") + ">CO</option></select>" +
      '<input class="inv-name" placeholder="Nombre completo" value="' + esc(inv.full_name) + '">' +
      '<input class="inv-orcid" placeholder="ORCID (opcional)" value="' + esc(inv.orcid || "") + '">' +
      '<button class="inv-del" onclick="this.parentNode.remove()" title="Eliminar">×</button></div>';
  }

  function toDateInput(s) { return s ? String(s).slice(0, 10) : ""; }

  function renderProjectForm(p) {
    p = p || {};
    var html = "";
    html += '<div class="form-section-label">Identificación</div>';
    html += '<div class="form-row"><label>Título</label><input id="p-titulo" value="' + esc(p.titulo || "") + '"></div>';
    html += '<div class="form-grid-2">';
    html += '<div class="form-row"><label>Código / ID</label><input id="p-codigo" value="' + esc(p.codigo || "") + '" placeholder="1230456"></div>';
    html += '<div class="form-row"><label>Departamento</label><input id="p-depto" value="' + esc(p.departamento || "") + '"></div>';
    html += "</div>";

    html += '<div class="form-section-label">Financiamiento</div>';
    html += '<div class="form-row"><label>Fuente</label><input id="p-fuente" value="' + esc(p.fuente_financiamiento || "") + '" placeholder="Fondecyt Regular, CORFO, VRID..."></div>';
    html += '<div class="form-row"><label>Monto (CLP)</label><input id="p-monto" type="number" value="' + esc(p.monto || "") + '" placeholder="0"></div>';
    html += '<input type="hidden" id="p-concursable" value="' + (p.concursable !== false ? "true" : "false") + '">';
    html += '<input type="hidden" id="p-externo" value="' + (p.externo !== false ? "true" : "false") + '">';
    html += renderTypeToggle(p);

    html += '<div class="form-section-label">Vigencia</div>';
    html += '<div class="form-grid-2">';
    html += '<div class="form-row"><label>Fecha inicio</label><input id="p-inicio" type="date" value="' + esc(toDateInput(p.fecha_inicio)) + '"></div>';
    html += '<div class="form-row"><label>Fecha fin</label><input id="p-fin" type="date" value="' + esc(toDateInput(p.fecha_fin)) + '"></div>';
    html += "</div>";

    html += '<div class="form-section-label">Investigadores</div>';
    html += '<div class="inv-list" id="inv-list">';
    var invs = (p.investigators && p.investigators.length) ? p.investigators : [{ rol: "IR", full_name: "", orcid: "" }];
    for (var i = 0; i < invs.length; i++) html += investigatorRow(invs[i]);
    html += "</div>";
    html += '<button class="add-inv-btn" id="btn-add-inv" type="button">+ Agregar investigador</button>';

    html += '<div class="form-section-label">Notas</div>';
    html += '<div class="form-row"><textarea id="p-notas" rows="3" placeholder="Observaciones, alcance, etc.">' + esc(p.notas || "") + "</textarea></div>";

    document.getElementById("project-form").innerHTML = html;
    document.getElementById("btn-add-inv").addEventListener("click", function () {
      document.getElementById("inv-list").insertAdjacentHTML("beforeend", investigatorRow(null));
    });
    bindToggles();
  }

  function renderTypeToggle(p) {
    var conc = p.concursable !== false;
    var ext = p.externo !== false;
    return '<div class="form-row"><label>Tipo de fondo</label><div class="toggle-row">' +
      '<button type="button" class="toggle-pill ' + (conc && ext ? "active" : "") + '" data-set="ext">Concursable externo</button>' +
      '<button type="button" class="toggle-pill ' + (conc && !ext ? "active" : "") + '" data-set="int">Concursable interno</button>' +
      '<button type="button" class="toggle-pill ' + (!conc ? "active" : "") + '" data-set="none">No concursable</button>' +
      "</div></div>";
  }

  function bindToggles() {
    var pills = document.querySelectorAll(".toggle-pill[data-set]");
    for (var i = 0; i < pills.length; i++) {
      pills[i].addEventListener("click", function (e) {
        var set = e.currentTarget.dataset.set;
        for (var j = 0; j < pills.length; j++) pills[j].classList.remove("active");
        e.currentTarget.classList.add("active");
        var conc = set !== "none";
        var ext = set === "ext";
        document.getElementById("p-concursable").value = conc ? "true" : "false";
        document.getElementById("p-externo").value = ext ? "true" : "false";
      });
    }
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
