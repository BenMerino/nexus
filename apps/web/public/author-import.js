// Author-import page entry. Exported `mount()` is re-runnable (legacy-mount.ts
// contract): the SPA page (spa/AuthorImportPage.tsx) calls it on every React
// mount. window.* assignments stay — the inline onclick handlers in the page
// markup depend on them.
export function mount() {
const searchInput = document.getElementById("author-search");
if (!searchInput) return;
searchInput.addEventListener("keydown", e => {
  if (e.key === "Enter") searchAuthor();
});

// Load author suggestions from existing DB tags
(async function loadSuggestions() {
  try {
    const resp = await fetch("/api/tag-stats");
    const tags = await resp.json();
    const authors = tags.filter(t => t.category === "author").slice(0, 20);
    if (!authors.length) return;
    const el = document.getElementById("suggestions");
    el.innerHTML = '<div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: bold; margin-bottom: 6px;">Authors in your database</div>' +
      '<div style="display: flex; flex-wrap: wrap; gap: 4px;">' +
      authors.map(a => `<span class="tag author" style="cursor: pointer;" onclick="pickSuggestion('${esc(a.value)}')">${esc(a.value)} (${a.count})</span>`).join("") +
      '</div>';
  } catch (e) {}
})();

function pickSuggestion(name) {
  document.getElementById("author-search").value = name;
  document.getElementById("suggestions").innerHTML = "";
  searchAuthor();
}

async function searchAuthor() {
  const q = document.getElementById("author-search").value.trim();
  if (!q) return;
  const status = document.getElementById("status");
  const results = document.getElementById("results");
  status.innerHTML = '<div class="status loading">Searching authors...</div>';
  results.innerHTML = "";

  const resp = await fetch(`/api/author-import?action=search&q=${encodeURIComponent(q)}`);
  const authors = await resp.json();

  if (!authors.length) { status.innerHTML = '<div class="status info">No authors found.</div>'; return; }
  status.innerHTML = `<div class="status success">${authors.length} authors found</div>`;

  results.innerHTML = authors.map(a => `
    <div class="card" style="display: flex; justify-content: space-between; align-items: center;">
      <div>
        <strong>${esc(a.name)}</strong>
        <div class="text-small text-muted mt-8">
          ${a.worksCount} works &middot; ${a.citedByCount} citations
          ${a.institutions.length ? ' &middot; ' + esc(a.institutions.join(', ')) : ''}
        </div>
      </div>
      <button onclick="selectAuthor('${esc(a.id)}', '${esc(a.name)}', ${a.worksCount})">Select</button>
    </div>
  `).join("");
}

async function selectAuthor(id, name, worksCount) {
  const status = document.getElementById("status");
  const results = document.getElementById("results");
  status.innerHTML = `<div class="status loading">Fetching works for ${esc(name)}...</div>`;
  results.innerHTML = "";

  let allDois = [], page = 1, hasMore = true;
  while (hasMore) {
    status.innerHTML = `<div class="status loading">Fetching works for ${esc(name)}... page ${page}</div>`;
    const resp = await fetch(`/api/author-import?action=works&authorId=${id}&page=${page}`);
    const data = await resp.json();
    allDois.push(...data.dois);
    hasMore = data.hasMore;
    page++;
  }

  if (!allDois.length) { status.innerHTML = '<div class="status info">No DOIs found for this author.</div>'; return; }

  status.innerHTML = `<div class="status success">${allDois.length} DOIs found for ${esc(name)}</div>`;
  window.__pendingDois = allDois;

  results.innerHTML = `
    <div class="card">
      <div style="max-height: 200px; overflow-y: auto; font-size: 12px; margin-bottom: 12px; border: 1px solid #eee; padding: 8px; border-radius: 4px;">
        ${allDois.map(d => `<div>${esc(d)}</div>`).join("")}
      </div>
      <div class="flex gap-8">
        <button onclick="importDois()">Import All (${allDois.length})</button>
        <button class="secondary" onclick="document.getElementById('results').innerHTML=''">Cancel</button>
      </div>
    </div>`;
}

async function importDois() {
  const dois = window.__pendingDois;
  if (!dois?.length) return;
  const status = document.getElementById("status");
  const results = document.getElementById("results");
  const batchSize = 5;
  let imported = 0, errors = [];

  for (let i = 0; i < dois.length; i += batchSize) {
    const batch = dois.slice(i, i + batchSize);
    status.innerHTML = `<div class="status loading">Importing... ${imported}/${dois.length}</div>`;
    try {
      const resp = await fetch("/api/author-import?action=import", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dois: batch }),
      });
      const data = await resp.json();
      imported += data.imported;
      if (data.errors?.length) errors.push(...data.errors);
    } catch (err) {
      errors.push(...batch.map(d => ({ doi: d, error: err.message })));
    }
  }

  status.innerHTML = `<div class="status success">Done: ${imported} imported` +
    (errors.length ? `, ${errors.length} errors` : '') + `</div>`;
  results.innerHTML = errors.length ? `<div class="card"><h3>Errors</h3><div class="text-small mt-8">` +
    errors.map(e => `<div>${esc(e.doi)}: ${esc(e.error)}</div>`).join("") + `</div></div>` : "";
}

function esc(s) {
  if (!s) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

window.pickSuggestion = pickSuggestion;
window.searchAuthor = searchAuthor;
window.selectAuthor = selectAuthor;
window.importDois = importDois;
}
