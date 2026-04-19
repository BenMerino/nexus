// Tag manager embedded in admin tenant detail — with ROR lookup for institutions
(function () {
  var candidates = [], synonyms = [];

  window.tmScan = function () {
    var cat = document.getElementById("tm-category").value;
    var status = document.getElementById("tm-status");
    status.textContent = "Scanning...";
    var url = "/api/tag-stats?action=candidates" + (cat ? "&category=" + cat : "");
    fetch(url).then(function (r) { return r.json(); }).then(function (data) {
      candidates = data;
      status.textContent = candidates.length + " group" + (candidates.length !== 1 ? "s" : "") + " found";
      renderCandidates();
      candidates.forEach(function (c, i) { if (c.category === "institution") lookupRor(c, i); });
    });
  };

  function renderCandidates() {
    var el = document.getElementById("tm-content");
    if (!candidates.length) { el.innerHTML = '<span style="color:#999;font-size:12px;">No duplicate candidates found.</span>'; return; }
    el.innerHTML = candidates.map(function (c, i) {
      var vals = c.values.map(function (v, j) {
        return '<span class="tag ' + esc(c.category) + (j === 0 ? ' selected' : '') + '" onclick="tmSelect(' + i + ',' + j + ')" data-idx="' + j + '">' + esc(v) + '</span>';
      }).join('<span style="color:#999;"> ~ </span>');
      return '<div class="tm-card" id="tm-card-' + i + '">' +
        '<div style="display:flex;justify-content:space-between;"><span class="tag ' + esc(c.category) + '">' + esc(c.category) + '</span>' +
        '<span style="font-size:11px;background:#e3f2fd;color:#1565c0;padding:2px 6px;border-radius:3px;">' + Math.round(c.score * 100) + '% match</span></div>' +
        '<div class="tm-vals">' + vals + '</div>' +
        '<div id="tm-ror-' + i + '" style="font-size:11px;color:#2e7d32;margin-top:4px;"></div>' +
        '<div style="display:flex;gap:8px;margin-top:6px;">' +
        '<button onclick="tmMerge(' + i + ')">Merge</button>' +
        '<button class="secondary" onclick="tmDismiss(' + i + ')">Not the same</button></div></div>';
    }).join("");
  }

  function lookupRor(c, idx) {
    fetch("/api/tag-stats?action=ror-lookup&q=" + encodeURIComponent(c.values[0]))
      .then(function (r) { return r.json(); })
      .then(function (results) {
        if (!results.length) return;
        var inst = results[0];
        candidates[idx]._ror = inst.ror;
        candidates[idx]._rorName = inst.name;
        var el = document.getElementById("tm-ror-" + idx);
        if (!el) return;
        el.innerHTML = 'ROR: <strong>' + esc(inst.name) + '</strong> (' + esc(inst.ror || "none") + ')' +
          ' <button style="font-size:10px;padding:1px 6px;" onclick="tmUseRor(' + idx + ')">Use as canonical</button>';
      });
  }

  window.tmUseRor = function (idx) {
    var c = candidates[idx];
    if (!c._rorName) return;
    // Add the ROR canonical name as a selectable option
    if (c.values.indexOf(c._rorName) === -1) c.values.push(c._rorName);
    c._sel = c.values.indexOf(c._rorName);
    renderCandidates();
    // Re-select the ROR name
    var card = document.getElementById("tm-card-" + idx);
    if (card) card.querySelectorAll(".tag[data-idx]").forEach(function (el, j) {
      el.classList.toggle("selected", j === c._sel);
    });
  };

  window.tmSelect = function (ci, vi) {
    var card = document.getElementById("tm-card-" + ci);
    card.querySelectorAll(".tag[data-idx]").forEach(function (el, j) { el.classList.toggle("selected", j === vi); });
    candidates[ci]._sel = vi;
  };

  window.tmMerge = function (idx) {
    var c = candidates[idx], sel = c._sel || 0;
    var canonical = c.values[sel];
    var rorId = c._ror || null;
    var variants = c.values.filter(function (_, i) { return i !== sel; });
    var done = 0;
    variants.forEach(function (variant) {
      fetch("/api/tag-stats?action=confirm", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: c.category, variant: variant, canonical: canonical, ror_id: rorId }),
      }).then(function () {
        done++;
        if (done === variants.length) {
          candidates.splice(idx, 1);
          document.getElementById("tm-status").textContent = "Merged! " + candidates.length + " remaining";
          renderCandidates();
        }
      });
    });
  };

  window.tmDismiss = function (idx) {
    var c = candidates[idx];
    fetch("/api/tag-stats?action=dismiss", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: c.category, valueA: c.values[0], valueB: c.values[1] }),
    }).then(function () { candidates.splice(idx, 1); renderCandidates(); });
  };

  window.tmShowSynonyms = function () {
    var el = document.getElementById("tm-content");
    el.innerHTML = '<span style="color:#999;font-size:12px;">Loading...</span>';
    fetch("/api/tag-stats?action=synonyms").then(function (r) { return r.json(); }).then(function (data) {
      synonyms = data;
      if (!synonyms.length) { el.innerHTML = '<span style="color:#999;font-size:12px;">No synonyms configured yet.</span>'; return; }
      el.innerHTML = synonyms.map(function (s) {
        var ror = s.ror_id ? ' <span style="font-size:10px;color:#1565c0;">ROR:' + esc(s.ror_id) + '</span>' : '';
        return '<div class="synonym-row">' +
          '<span class="tag ' + esc(s.category) + '">' + esc(s.category) + '</span>' +
          '<span>' + esc(s.variant) + '</span><span style="color:#999;">&rarr;</span><strong>' + esc(s.canonical) + '</strong>' + ror +
          '<span style="font-size:11px;color:#999;">(' + esc(s.source) + ')</span>' +
          '<button class="secondary" style="margin-left:auto;font-size:11px;padding:2px 6px;" onclick="tmRemoveSyn(' + s.id + ')">Remove</button></div>';
      }).join("");
    });
  };

  window.tmRemoveSyn = function (id) {
    fetch("/api/tag-stats?action=delete-synonym&id=" + id, { method: "DELETE" }).then(function () { tmShowSynonyms(); });
  };

  window.tmRorResolve = function () {
    var status = document.getElementById("tm-status");
    var el = document.getElementById("tm-content");
    status.textContent = "Resolving institutions via ROR...";
    el.innerHTML = '<span style="color:#999;font-size:12px;">Looking up each institution on OpenAlex — this may take a moment...</span>';
    fetch("/api/tag-stats?action=ror-resolve", { method: "POST" })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        status.textContent = data.resolved + " mapped, " + data.removed + " junk removed, " + data.skipped + " skipped";
        if (!data.mappings.length && !data.removed) { el.innerHTML = '<span style="color:#999;font-size:12px;">All institutions already clean.</span>'; return; }
        var html = data.removed ? '<div style="font-size:12px;margin-bottom:8px;color:#e65100;">' + data.removed + ' non-institution tags deleted (no ROR match)</div>' : '';
        html += '<table><tr><th>Variant</th><th>Canonical (ROR)</th><th>ROR ID</th></tr>';
        el.innerHTML = html +
          data.mappings.map(function (m) {
            return '<tr><td>' + esc(m.variant) + '</td><td><strong>' + esc(m.canonical) + '</strong></td><td style="font-size:11px;">' + esc(m.ror) + '</td></tr>';
          }).join("") + '</table>';
      }).catch(function (err) { status.textContent = "Error: " + err.message; });
  };
})();
