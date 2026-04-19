let allRecords = [];
let myOrcid = null;

async function loadRecords() {
  const [recs, me] = await Promise.all([
    fetch("/api/records").then(r => r.json()),
    fetch("/api/auth?action=me").then(r => r.ok ? r.json() : null).catch(() => null),
  ]);
  allRecords = recs;
  myOrcid = me?.profile?.orcid || null;
  const mineToggle = document.getElementById("mine-toggle");
  if (mineToggle) {
    mineToggle.style.display = myOrcid ? "inline-flex" : "none";
    if (new URLSearchParams(location.search).get("mine") === "1") {
      document.getElementById("mine-check").checked = true;
    }
  }
  renderTable();
}

function renderTable() {
  let records = [...allRecords];
  const query = document.getElementById("rec-search").value.trim().toLowerCase();
  const sort = document.getElementById("sort-select").value;
  const mineOnly = document.getElementById("mine-check")?.checked;

  if (mineOnly && myOrcid) {
    records = records.filter(r => (r.affiliations || []).some(a => a.orcid === myOrcid));
  }

  if (query) {
    records = records.filter(r =>
      (r.title || "").toLowerCase().includes(query) ||
      (r.authors || []).join(", ").toLowerCase().includes(query) ||
      (r.journal || "").toLowerCase().includes(query) ||
      (r.doi || "").toLowerCase().includes(query) ||
      (r.publisher || "").toLowerCase().includes(query)
    );
  }

  switch (sort) {
    case "newest": records.sort((a, b) => b.id - a.id); break;
    case "oldest": records.sort((a, b) => a.id - b.id); break;
    case "citations": records.sort((a, b) => (b.citation_count || 0) - (a.citation_count || 0)); break;
    case "title": records.sort((a, b) => (a.title || "").localeCompare(b.title || "")); break;
  }

  const countEl = document.getElementById("record-count");
  const emptyEl = document.getElementById("empty-state");
  const tableEl = document.getElementById("records-table");
  const body = document.getElementById("records-body");

  countEl.textContent = `${records.length} record${records.length !== 1 ? "s" : ""}` +
    (query ? ` matching "${query}"` : "");

  if (!records.length) { tableEl.style.display = "none"; emptyEl.style.display = "block"; }
  else { tableEl.style.display = "table"; emptyEl.style.display = "none"; }

  body.innerHTML = records.map((r, i) => `
    <tr class="record-row" onclick="toggleDetail(${i})" style="cursor: pointer;">
      <td style="max-width: 300px;">
        <div style="font-weight: bold;">${escHtml(r.title || r.doi)}</div>
        <div class="text-small text-muted">${escHtml(r.doi)}</div>
      </td>
      <td style="max-width: 200px;">${escHtml((r.authors || []).slice(0, 3).join(", "))}${(r.authors || []).length > 3 ? ` +${(r.authors || []).length - 3} more` : ""}</td>
      <td>${escHtml(r.journal || "-")}</td>
      <td>${escHtml(r.published || "-")}</td>
      <td>${r.citation_count != null ? r.citation_count : "-"}</td>
      <td><span class="tag ${r.type || ''}">${escHtml(r.type || "-")}</span></td>
      <td>${r.open_access ? "Yes" : "No"}</td>
    </tr>
    <tr class="detail-row" id="detail-${i}" style="display: none;">
      <td colspan="7" style="padding: 16px 24px; background: var(--bg-alt, #f8f9fa);">
        ${renderDetail(r)}
      </td>
    </tr>
  `).join("");
}

function toggleDetail(i) {
  const row = document.getElementById("detail-" + i);
  row.style.display = row.style.display === "none" ? "table-row" : "none";
}

function renderDetail(r) {
  const affs = r.affiliations || [];
  let html = "";
  if (r.abstract) html += `<div style="margin-bottom: 12px;"><strong>Abstract:</strong> <span class="text-small">${escHtml(r.abstract)}</span></div>`;
  html += `<div style="margin-bottom: 12px;"><strong>Authors & Affiliations:</strong></div>`;
  if (affs.length) {
    html += '<table style="width: 100%; font-size: 13px; border-collapse: collapse;">';
    html += '<tr style="border-bottom: 1px solid #ddd;"><th style="text-align:left; padding: 4px 8px;">Author</th><th style="text-align:left; padding: 4px 8px;">ORCID</th><th style="text-align:left; padding: 4px 8px;">Affiliations</th></tr>';
    for (const a of affs) {
      const instNames = (a.affiliations || []).map(af => {
        let s = escHtml(af.name || "");
        if (af.country) s += ` <span class="text-muted">(${escHtml(af.country)})</span>`;
        return s;
      });
      html += `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 4px 8px; white-space: nowrap;">${escHtml(a.name)}</td><td style="padding: 4px 8px; font-size: 11px;">${a.orcid ? escHtml(a.orcid) : '<span class="text-muted">-</span>'}</td><td style="padding: 4px 8px;">${instNames.length ? instNames.join("<br>") : '<span class="text-muted">No affiliation data</span>'}</td></tr>`;
    }
    html += '</table>';
  } else {
    html += `<div class="text-small">${(r.authors || []).map(a => escHtml(a)).join(", ") || "No authors"}</div>`;
  }
  html += '<div style="margin-top: 12px; display: flex; gap: 24px; flex-wrap: wrap; font-size: 12px;">';
  if (r.publisher) html += `<div><strong>Publisher:</strong> ${escHtml(r.publisher)}</div>`;
  if (r.venue) html += `<div><strong>Venue:</strong> ${escHtml(r.venue)}</div>`;
  if (r.url) html += `<div><strong>URL:</strong> <a href="${escHtml(r.url)}" target="_blank">${escHtml(r.url)}</a></div>`;
  if (r.open_access_url) html += `<div><strong>OA Link:</strong> <a href="${escHtml(r.open_access_url)}" target="_blank">Open Access PDF</a></div>`;
  html += '</div>';
  html += `<div style="margin-top: 16px; border-top: 1px solid #eee; padding-top: 12px;">
    <button onclick="deleteRecord(${r.id}, '${escHtml(r.doi).replace(/'/g, "\\'")}', event)"
      style="background: #dc3545; color: white; border: none; padding: 6px 14px; border-radius: 4px; cursor: pointer; font-size: 12px;">
      Delete Record
    </button>
  </div>`;
  return html;
}

async function deleteRecord(id, doi, event) {
  event.stopPropagation();
  if (!confirm(`Delete record for DOI:\n${doi}\n\nThis will also remove associated tags and submissions.`)) return;
  const resp = await fetch(`/api/records/${id}`, { method: "DELETE" });
  if (resp.ok) { allRecords = allRecords.filter(r => r.id !== id); renderTable(); }
  else { const err = await resp.json(); alert("Failed to delete: " + (err.error || "Unknown error")); }
}

document.getElementById("rec-search").addEventListener("input", renderTable);
document.getElementById("sort-select").addEventListener("change", renderTable);
document.getElementById("mine-check")?.addEventListener("change", renderTable);
loadRecords();
