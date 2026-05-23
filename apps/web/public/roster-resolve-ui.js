// ORCID helper: assistive, human-driven (no AI, no auto-link). Bulk-searches
// OpenAlex under the tenant ROR for academics missing an ORCID, renders each
// with candidate profiles + a free-text ORCID field, and saves only what the
// admin confirms.
(function () {
  var tenantId = null;
  fetch("/api/auth?action=me").then(function (r) { return r.json(); }).then(function (d) { tenantId = d.tenantId; });

  document.getElementById("resolve-find-btn").addEventListener("click", findCandidates);
  document.getElementById("resolve-save-btn").addEventListener("click", saveSelected);

  function findCandidates() {
    var btn = document.getElementById("resolve-find-btn");
    btn.disabled = true;
    document.getElementById("resolve-tbody").innerHTML = "";
    fetchPage(0);
  }

  function fetchPage(offset) {
    var status = document.getElementById("resolve-status");
    fetch("/api/auth?action=roster-suggest", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenant_id: tenantId, offset: offset, limit: 30 }),
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok) { status.textContent = res.j.error || "Search failed."; document.getElementById("resolve-find-btn").disabled = false; return; }
        var j = res.j;
        j.rows.forEach(addRow);
        document.getElementById("resolve-table").style.display = "";
        status.textContent = "Searched " + j.nextOffset + " / " + j.total + " academics…";
        if (!j.done) {
          fetchPage(j.nextOffset);
        } else {
          status.textContent = "Review candidates, then save. " + j.total + " academics without ORCID.";
          document.getElementById("resolve-find-btn").disabled = false;
          document.getElementById("resolve-save-btn").style.display = "";
        }
      })
      .catch(function (err) { status.textContent = "Error: " + err.message; document.getElementById("resolve-find-btn").disabled = false; });
  }

  function addRow(row) {
    var tr = document.createElement("tr");
    tr.dataset.userId = row.userId;

    var nameTd = document.createElement("td");
    nameTd.textContent = row.fullName;
    tr.appendChild(nameTd);

    var orcidInput = document.createElement("input");
    orcidInput.type = "text";
    orcidInput.placeholder = "0000-0000-0000-0000";
    orcidInput.className = "resolve-orcid";
    orcidInput.style.cssText = "font-family:var(--mono);font-size:11px;width:170px;";

    var candTd = document.createElement("td");
    if (row.candidates && row.candidates.length) {
      var sel = document.createElement("select");
      sel.style.cssText = "font-size:11px;max-width:320px;";
      var none = document.createElement("option");
      none.value = ""; none.textContent = "— skip —";
      sel.appendChild(none);
      row.candidates.forEach(function (c) {
        var o = document.createElement("option");
        o.value = c.orcid;
        o.textContent = c.name + "  (" + c.worksCount + " works)";
        sel.appendChild(o);
      });
      sel.addEventListener("change", function () { orcidInput.value = sel.value; });
      candTd.appendChild(sel);
    } else {
      candTd.innerHTML = '<span class="text-muted text-small">no OpenAlex match — paste manually</span>';
    }
    tr.appendChild(candTd);

    var orcidTd = document.createElement("td");
    orcidTd.appendChild(orcidInput);
    tr.appendChild(orcidTd);

    document.getElementById("resolve-tbody").appendChild(tr);
  }

  function saveSelected() {
    var assignments = [];
    document.querySelectorAll("#resolve-tbody tr").forEach(function (tr) {
      var v = tr.querySelector(".resolve-orcid").value.trim();
      if (v) assignments.push({ userId: parseInt(tr.dataset.userId), orcid: v });
    });
    var status = document.getElementById("resolve-status");
    if (!assignments.length) { status.textContent = "Nothing selected to save."; return; }
    status.textContent = "Saving " + assignments.length + " ORCIDs…";
    fetch("/api/auth?action=roster-save-orcids", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenant_id: tenantId, assignments: assignments }),
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok) { status.textContent = res.j.error || "Save failed."; return; }
        var inv = (res.j.invalid && res.j.invalid.length) || 0;
        status.textContent = "Saved " + res.j.saved + " ORCIDs" + (inv ? (", " + inv + " invalid (check format)") : "") + ". You can now ingest publications.";
      })
      .catch(function (err) { status.textContent = "Error: " + err.message; });
  }
})();
