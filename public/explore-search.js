(() => {
document.getElementById("search-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") doSearch();
});

async function doSearch() {
  const q = document.getElementById("search-input").value.trim();
  const statusEl = document.getElementById("search-status");
  const resultsEl = document.getElementById("search-results");

  if (!q) { statusEl.innerHTML = ""; resultsEl.innerHTML = ""; return; }

  statusEl.innerHTML = '<div class="status loading">Searching...</div>';
  try {
    const resp = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    const records = await resp.json();

    if (!records.length) {
      statusEl.innerHTML = '<div class="status info">No results found.</div>';
      resultsEl.innerHTML = "";
      return;
    }

    statusEl.innerHTML = `<div class="status success">${records.length} result${records.length !== 1 ? "s" : ""} found</div>`;
    resultsEl.innerHTML = records.map(r => `
      <div class="search-result">
        <h4>${escHtml(r.title || r.doi)}</h4>
        <div class="meta">
          ${escHtml(r.doi)}
          ${r.authors?.length ? " &mdash; " + escHtml(r.authors.slice(0, 3).join(", ")) : ""}
          ${r.journal ? " &mdash; " + escHtml(r.journal) : ""}
          ${r.published ? " (" + escHtml(r.published) + ")" : ""}
        </div>
        <div class="mt-8">
          ${r.citation_count != null ? `<span class="tag">Citations: ${r.citation_count}</span>` : ""}
          ${r.type ? `<span class="tag ${r.type}">${escHtml(r.type)}</span>` : ""}
          ${r.open_access ? '<span class="tag journal">Open Access</span>' : ""}
          ${r.open_access_url ? `<a href="${escHtml(r.open_access_url)}" target="_blank" class="text-small">PDF</a>` : ""}
        </div>
        ${r.abstract ? `<p class="text-small mt-8" style="color: #666; max-width: 700px;">${escHtml(r.abstract).substring(0, 250)}${r.abstract.length > 250 ? "..." : ""}</p>` : ""}
      </div>
    `).join("");
  } catch (err) {
    statusEl.innerHTML = `<div class="status error">Error: ${err.message}</div>`;
  }
}
})();
