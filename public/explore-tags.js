(() => {
let tagStats = [];

async function loadTags() {
  if (tagStats.length) { renderTagCloud(); return; }
  const resp = await fetch("/api/tag-stats");
  tagStats = await resp.json();
  renderTagCloud();
}

function renderTagCloud(category = "all") {
  const cloud = document.getElementById("tag-cloud");
  let tags = tagStats;
  if (category !== "all") tags = tags.filter(t => t.category === category);

  if (!tags.length) {
    cloud.innerHTML = '<span class="text-muted">No tags yet. Submit some DOIs first.</span>';
    return;
  }

  const maxCount = Math.max(...tags.map(t => t.count));
  cloud.innerHTML = tags.map(t => {
    const size = 12 + Math.round((t.count / maxCount) * 14);
    return `<span class="tag ${t.category}" style="font-size: ${size}px; padding: 4px 10px;" onclick="showTagDetail('${escAttr(t.category)}', '${escAttr(t.value)}')" title="${t.count} record${t.count !== 1 ? 's' : ''}">${escHtml(t.value)} (${t.count})</span>`;
  }).join("");
}

function filterTags(cat, btn) {
  document.querySelectorAll(".tag-filter").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  renderTagCloud(cat);
}

async function showTagDetail(category, value) {
  const detailEl = document.getElementById("tag-detail");
  const titleEl = document.getElementById("tag-detail-title");
  const recordsEl = document.getElementById("tag-detail-records");

  detailEl.style.display = "block";
  titleEl.textContent = `${category}: ${value}`;

  const resp = await fetch(`/api/search?q=${encodeURIComponent(value)}`);
  const records = await resp.json();

  if (!records.length) {
    recordsEl.innerHTML = '<span class="text-muted">No records found.</span>';
    return;
  }

  recordsEl.innerHTML = records.map(r => `
    <div style="padding: 6px 0; border-bottom: 1px solid #eee;">
      <strong>${escHtml(r.title || r.doi)}</strong>
      <span class="text-small text-muted">${escHtml(r.published || "")}</span>
    </div>
  `).join("");
}

window.loadTags = loadTags;
window.filterTags = filterTags;
window.showTagDetail = showTagDetail;
})();
