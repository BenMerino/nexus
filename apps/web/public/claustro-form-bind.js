// Form event-binding + collection for the Projects page. Was an IIFE in
// proyectos.html; hoisted to a re-runnable mount() (legacy-mount.ts contract)
// so spa/ProjectsPage.tsx can drive it on every React mount. The body only
// (re)assigns window.claustroFormBind (its bindEvents runs later, when the form
// is opened) — idempotent registration, so mount() returns no cleanup.
export function mount() {
  var fmtCLP = function (n) { return window.fmtCLP(n); };

  function bindEvents() {
    document.getElementById("p-funding").addEventListener("change", function (e) {
      var f = window.fundingById(e.target.value);
      if (!f) return;
      setToggle("t-concursable", "concursable", f.concursable);
      setToggle("t-externo", "externo", f.external);
    });
    document.getElementById("p-monto").addEventListener("input", function (e) {
      var hint = document.getElementById("monto-hint");
      var v = Number(e.target.value);
      if (v > 0) { hint.textContent = fmtCLP(v); hint.style.display = ""; }
      else hint.style.display = "none";
    });
    bindToggle("t-concursable", "concursable");
    bindToggle("t-externo", "externo");
    document.getElementById("btn-add-inv").addEventListener("click", function () {
      var html = window.claustroFormTpl.investigatorRow(null);
      var div = document.createElement("div");
      div.innerHTML = html;
      document.getElementById("inv-list").appendChild(div.firstChild);
      bindInvListeners();
    });
    bindInvListeners();
  }

  function bindToggle(containerId, key) {
    document.getElementById(containerId).addEventListener("click", function (e) {
      var btn = e.target.closest("[data-" + key + "]");
      if (!btn) return;
      var pills = e.currentTarget.querySelectorAll(".pill");
      for (var i = 0; i < pills.length; i++) pills[i].classList.remove("on");
      btn.classList.add("on");
    });
  }

  function setToggle(containerId, key, val) {
    var pills = document.getElementById(containerId).querySelectorAll(".pill");
    for (var i = 0; i < pills.length; i++) {
      pills[i].classList.toggle("on", pills[i].dataset[key] === String(val));
    }
  }

  function bindInvListeners() {
    var rows = document.querySelectorAll(".investigator-row");
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var irBtn = row.querySelector(".ir-btn");
      var rmBtn = row.querySelector(".remove-btn");
      if (!irBtn._bound) {
        irBtn._bound = true;
        irBtn.addEventListener("click", function (e) {
          var allRows = document.querySelectorAll(".investigator-row");
          for (var j = 0; j < allRows.length; j++) {
            var b = allRows[j].querySelector(".ir-btn");
            b.classList.remove("on"); b.dataset.rol = "CO";
          }
          e.currentTarget.classList.add("on"); e.currentTarget.dataset.rol = "IR";
        });
      }
      if (!rmBtn._bound) {
        rmBtn._bound = true;
        rmBtn.addEventListener("click", function (e) {
          var listRows = document.querySelectorAll(".investigator-row");
          if (listRows.length <= 1) return;
          e.currentTarget.parentNode.remove();
        });
      }
      rmBtn.disabled = document.querySelectorAll(".investigator-row").length <= 1;
    }
  }

  function collectForm() {
    var get = function (id) { return document.getElementById(id).value; };
    var fundingSelect = document.getElementById("p-funding");
    var fundingName = fundingSelect.options[fundingSelect.selectedIndex].textContent;
    var conc = document.querySelector("#t-concursable .pill.on");
    var ext = document.querySelector("#t-externo .pill.on");
    var rows = document.querySelectorAll(".investigator-row");
    var invs = [];
    for (var i = 0; i < rows.length; i++) {
      var name = rows[i].querySelector(".inv-name").value.trim();
      if (!name) continue;
      invs.push({
        full_name: name,
        orcid: rows[i].querySelector(".inv-orcid").value.trim() || null,
        rol: rows[i].querySelector(".ir-btn").dataset.rol,
      });
    }
    return {
      titulo: get("p-titulo").trim(),
      fuente_financiamiento: fundingName,
      codigo: get("p-codigo").trim() || null,
      monto: get("p-monto") ? Number(get("p-monto")) : null,
      departamento: get("p-depto").trim() || null,
      fecha_inicio: get("p-inicio") || null,
      fecha_fin: get("p-fin") || null,
      concursable: conc ? conc.dataset.concursable === "true" : true,
      externo: ext ? ext.dataset.externo === "true" : true,
      notas: get("p-notas").trim() || null,
      investigators: invs,
    };
  }

  window.claustroFormBind = { bindEvents: bindEvents, collectForm: collectForm };
}
