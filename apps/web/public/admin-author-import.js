// Institution-level OpenAlex import for admin tenant detail.
// Exported `mount()` is re-runnable (legacy-mount.ts contract): the SPA page
// (spa/AdminPage.tsx) calls it on every React mount. window.* assignments stay
// — the inline onclick handlers in the page markup depend on them.
export function mount() {
  var statusEl, resultsEl, allAuthors = [], tenantRor = null;

  function init() {
    statusEl = document.getElementById("import-status");
    resultsEl = document.getElementById("import-results");
  }

  window.startInstitutionImport = function (ror) {
    init();
    tenantRor = ror;
    allAuthors = [];
    statusEl.innerHTML = '<div class="status loading">Fetching academics from OpenAlex...</div>';
    resultsEl.innerHTML = "";
    fetchPage(1);
  };

  function fetchPage(page) {
    fetch("/api/author-import?action=institution&ror=" + encodeURIComponent(tenantRor) + "&page=" + page)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        allAuthors = allAuthors.concat(data.authors);
        statusEl.innerHTML = '<div class="status loading">Fetching academics... ' + allAuthors.length + '/' + data.totalCount + '</div>';
        if (data.hasMore) { fetchPage(page + 1); return; }
        renderAuthorList();
      }).catch(function (err) {
        statusEl.innerHTML = '<div class="status error">Error: ' + esc(err.message) + '</div>';
      });
  }

  function renderAuthorList() {
    if (!allAuthors.length) { statusEl.innerHTML = '<div class="status info">No academics found for this ROR.</div>'; return; }
    statusEl.innerHTML = '<div class="status success">' + allAuthors.length + ' academics found</div>';
    var html = '<table><tr><th>Name</th><th>ORCID</th><th>Works</th><th>Citations</th><th></th></tr>';
    allAuthors.forEach(function (a, i) {
      html += '<tr><td>' + esc(a.name) + '</td>';
      html += '<td style="font-size:11px;">' + (a.orcid || '\u2014') + '</td>';
      html += '<td>' + a.worksCount + '</td><td>' + a.citedByCount + '</td>';
      html += '<td><button onclick="importAuthorWorks(' + i + ')">Import DOIs</button></td></tr>';
    });
    html += '</table>';
    html += '<button onclick="importAllAuthors()" style="margin-top:12px;">Import All DOIs (' + allAuthors.length + ' authors)</button>';
    resultsEl.innerHTML = html;
  }

  window.importAuthorWorks = function (idx) {
    init();
    var a = allAuthors[idx];
    if (!a) return;
    statusEl.innerHTML = '<div class="status loading">Fetching DOIs for ' + esc(a.name) + '...</div>';
    collectDois(a.id, function (dois) {
      if (!dois.length) { statusEl.innerHTML = '<div class="status info">No DOIs found for ' + esc(a.name) + '</div>'; return; }
      statusEl.innerHTML = '<div class="status loading">Importing ' + dois.length + ' DOIs...</div>';
      batchImport(dois, function (imported, errors) {
        statusEl.innerHTML = '<div class="status success">' + esc(a.name) + ': ' + imported + ' imported' +
          (errors.length ? ', ' + errors.length + ' errors' : '') + '</div>';
      });
    });
  };

  window.importAllAuthors = function () {
    init();
    var queue = allAuthors.slice(), total = queue.length, done = 0, allImported = 0;
    function next() {
      if (!queue.length) {
        statusEl.innerHTML = '<div class="status success">Done: ' + allImported + ' DOIs imported from ' + total + ' authors</div>';
        return;
      }
      var a = queue.shift();
      done++;
      statusEl.innerHTML = '<div class="status loading">Author ' + done + '/' + total + ': ' + esc(a.name) + '...</div>';
      collectDois(a.id, function (dois) {
        if (!dois.length) { next(); return; }
        batchImport(dois, function (imported) { allImported += imported; next(); });
      });
    }
    next();
  };

  function collectDois(authorId, callback) {
    var dois = [], page = 1;
    function go() {
      fetch("/api/author-import?action=works&authorId=" + authorId + "&page=" + page)
        .then(function (r) { return r.json(); })
        .then(function (d) {
          dois = dois.concat(d.dois);
          if (d.hasMore) { page++; go(); } else { callback(dois); }
        }).catch(function () { callback(dois); });
    }
    go();
  }

  function batchImport(dois, callback) {
    var i = 0, imported = 0, errors = [];
    function next() {
      if (i >= dois.length) { callback(imported, errors); return; }
      var batch = dois.slice(i, i + 5);
      fetch("/api/author-import?action=import", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dois: batch }),
      }).then(function (r) { return r.json(); }).then(function (d) {
        imported += d.imported;
        if (d.errors) errors = errors.concat(d.errors);
        i += 5; next();
      }).catch(function () { i += 5; next(); });
    }
    next();
  }
}
