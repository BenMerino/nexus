// Project card / stats / list renderer for the Projects page. Was an IIFE in
// proyectos.html; hoisted to a re-runnable mount() (legacy-mount.ts contract)
// so spa/ProjectsPage.tsx can drive it on every React mount. The body only
// (re)assigns window.claustroRender (consumed by claustro-app / projects-ui);
// idempotent registration, so mount() returns no cleanup. The cards it emits
// carry inline onclick="claustroEdit/claustroDelete" — those globals are set by
// claustro-app.js's mount().
export function mount() {
  var esc = function (s) { return window.claustroEsc(s); };
  var fmtCLP = function (n) { return window.fmtCLP(n); };

  function renderProjectCard(p, editingId) {
    var fundingName = (p.fuente_financiamiento || "Other");
    var ir = (p.investigators || []).filter(function (x) { return x.rol === "IR"; });
    var others = (p.investigators || []).filter(function (x) { return x.rol !== "IR"; });
    var html = '<article class="project-card' + (editingId === p.id ? " editing" : "") + '">';
    html += '<div class="project-card-top">';
    html += '<div class="project-funding mono">' + esc(fundingName) + "</div>";
    html += '<div class="project-flags">';
    if (p.concursable) html += '<span class="tag mono">COMPETITIVE</span>';
    if (p.externo) html += '<span class="tag mono tag-muted">EXTERNAL</span>';
    html += '<div class="project-actions">';
    html += '<button class="project-action-btn" onclick="claustroEdit(' + p.id + ')">Edit</button>';
    html += '<button class="project-action-btn danger" onclick="claustroDelete(' + p.id + ')">Delete</button>';
    html += "</div></div></div>";
    html += '<h3 class="project-title">' + esc(p.titulo) + "</h3>";
    html += '<div class="project-meta">';
    html += '<div><span>Code</span><span class="mono">' + esc(p.codigo || "—") + "</span></div>";
    html += '<div><span>Amount</span><span class="mono" style="color:var(--accent);">' + esc(fmtCLP(p.monto)) + "</span></div>";
    html += '<div><span>Faculty</span><span>' + esc(p.departamento || "—") + "</span></div>";
    html += '<div><span>Period</span><span class="mono">' + esc((p.fecha_inicio || "?").slice(0, 10)) + " → " + esc((p.fecha_fin || "?").slice(0, 10)) + "</span></div>";
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
    var roleLabel = rol === "IR" ? "PI" : "Co";
    var unmatched = !inv.user_id ? '<span class="inv-unmatched" title="No match with a tenant user">NO MATCH</span>' : "";
    return '<div class="inv-line' + coClass + '">' +
      '<span class="inv-role-badge' + roleClass + '">' + roleLabel + "</span>" +
      '<span class="inv-name">' + esc(inv.full_name) + "</span>" +
      (inv.orcid ? '<span class="inv-orcid">' + esc(inv.orcid) + "</span>" : "") +
      unmatched + "</div>";
  }

  function renderProjectsList(rows, editingId) {
    var wrap = document.getElementById("projects-list");
    if (!rows || !rows.length) {
      wrap.innerHTML = '<div class="empty-state"><div class="empty-glyph">∅</div><div class="empty-head">No projects.</div><div class="empty-sub">No projects recorded for this filter yet.</div></div>';
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
    document.getElementById("stat-conc-sub").textContent = "of " + total + " projects";
    document.getElementById("stat-ext-val").textContent = ext;
    // The header count/amount tags were removed (redundant with the stat cards
    // above); guard so the render survives their absence.
    const tagCount = document.getElementById("tag-count");
    if (tagCount) tagCount.textContent = total + " PROJECTS";
    const tagAmount = document.getElementById("tag-amount");
    if (tagAmount) tagAmount.textContent = window.fmtCLP(amount);
  }

  window.claustroRender = {
    projectsList: renderProjectsList,
    stats: renderStats,
    projectForm: function (p) { return window.claustroForm.renderProjectForm(p); },
    collectForm: function () { return window.claustroForm.collectForm(); },
  };
}
