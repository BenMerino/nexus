// Organization scheme — renders the tenant roster as a collapsible
// Faculty -> Department -> people tree with per-node metrics. Read-only;
// fetches the org-tree endpoint (any authenticated user of the tenant).
(function () {
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c];
    });
  }

  // metric pills shown on a faculty/department row
  function metrics(head, withOrcid, papers) {
    var full = head > 0 && withOrcid === head;
    return '<span class="org-metrics">'
      + '<span class="org-pill">' + head + (head === 1 ? " academic" : " academics") + '</span>'
      + '<span class="org-pill' + (full ? " cov-full" : "") + '">' + withOrcid + "/" + head + ' ORCID</span>'
      + '<span class="org-pill">' + papers + (papers === 1 ? " paper" : " papers") + '</span>'
      + '</span>';
  }

  function personRow(p) {
    var orcid = p.orcid
      ? '<a class="org-orcid" href="https://orcid.org/' + esc(p.orcid) + '" target="_blank" rel="noopener">' + esc(p.orcid) + "</a>"
      : '<span class="org-orcid none">no ORCID</span>';
    return '<div class="org-node"><div class="org-row leaf">'
      + '<span class="org-twist"></span>'
      + '<span class="org-name person">' + esc(p.name) + ' <span class="text-muted">· ' + esc(p.category || "") + "</span></span>"
      + '<span class="org-metrics">' + orcid
      + '<span class="org-pill">' + p.paperCount + (p.paperCount === 1 ? " paper" : " papers") + "</span></span>"
      + "</div></div>";
  }

  // a collapsible node: header row + hidden children container.
  // labelHtml is pre-built safe HTML (caller escapes the dynamic parts).
  function branch(labelHtml, cls, metricsHtml, childrenHtml) {
    var node = document.createElement("div");
    node.className = "org-node";
    node.innerHTML =
      '<div class="org-row">'
      + '<span class="org-twist">▶</span>'
      + '<span class="org-name ' + cls + '">' + labelHtml + "</span>"
      + metricsHtml
      + "</div>"
      + '<div class="org-children">' + childrenHtml + "</div>";
    var row = node.querySelector(".org-row");
    var twist = node.querySelector(".org-twist");
    var kids = node.querySelector(".org-children");
    row.addEventListener("click", function () {
      var open = kids.classList.toggle("open");
      twist.classList.toggle("open", open);
    });
    return node;
  }

  function render(data) {
    document.getElementById("t-fac").textContent = data.totals.faculties;
    document.getElementById("t-inst").textContent = data.totals.institutes;
    document.getElementById("t-head").textContent = data.totals.headcount;
    document.getElementById("t-orcid").textContent = data.totals.withOrcid;
    document.getElementById("t-papers").textContent = data.totals.papers;

    var tree = document.getElementById("org-tree");
    tree.innerHTML = "";
    if (!data.faculties.length) {
      document.getElementById("org-empty").style.display = "";
      return;
    }
    for (var i = 0; i < data.faculties.length; i++) {
      var f = data.faculties[i];
      var depHtml = "";
      for (var j = 0; j < f.departments.length; j++) {
        var d = f.departments[j];
        var peopleHtml = d.people.map(personRow).join("");
        // department branch is built as HTML then re-wired below
        depHtml += '<div class="org-node" data-dep="1">'
          + '<div class="org-row">'
          + '<span class="org-twist">▶</span>'
          + '<span class="org-name dep">' + esc(d.name) + "</span>"
          + metrics(d.headcount, d.withOrcid, d.papers)
          + "</div>"
          + '<div class="org-children">' + peopleHtml + "</div></div>";
      }
      var kindLabel = { faculty: "Faculty", institute: "Institute", other: "Other" }[f.kind] || "";
      var facLabel = esc(f.name) + (kindLabel ? ' <span class="org-kind">' + kindLabel + "</span>" : "");
      var facNode = branch(facLabel, "fac", metrics(f.headcount, f.withOrcid, f.papers), depHtml);
      // wire up the department rows (built as raw HTML inside the faculty)
      facNode.querySelectorAll('[data-dep="1"]').forEach(function (depNode) {
        var row = depNode.querySelector(".org-row");
        var twist = depNode.querySelector(".org-twist");
        var kids = depNode.querySelector(".org-children");
        row.addEventListener("click", function (e) {
          e.stopPropagation();
          var open = kids.classList.toggle("open");
          twist.classList.toggle("open", open);
        });
      });
      tree.appendChild(facNode);
    }
  }

  fetch("/api/auth?action=org-tree")
    .then(function (r) { return r.json(); })
    .then(function (j) {
      if (!j.ok) {
        var e = document.getElementById("org-err");
        e.style.display = ""; e.textContent = j.error || "Failed to load organization scheme.";
        return;
      }
      render(j);
    })
    .catch(function () {
      var e = document.getElementById("org-err");
      e.style.display = ""; e.textContent = "Network error loading organization scheme.";
    });
})();
