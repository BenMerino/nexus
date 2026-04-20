(() => {
let candidates = [];
let synonyms = [];

function esc(s) { return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

async function loadCandidates() {
  const cat = document.getElementById("category-filter").value;
  const status = document.getElementById("scan-status");
  status.textContent = "Scanning...";
  const url = `/api/tag-stats?action=candidates${cat ? `&category=${cat}` : ""}`;
  const resp = await fetch(url);
  candidates = await resp.json();
  status.textContent = `${candidates.length} group${candidates.length !== 1 ? "s" : ""} found`;
  renderCandidates();
}

function renderCandidates() {
  const el = document.getElementById("candidates-tab");
  if (!candidates.length) {
    el.innerHTML = '<div class="card"><span class="text-muted">No duplicate candidates found.</span></div>';
    return;
  }
  el.innerHTML = candidates.map((c, i) => `
    <div class="candidate-card" id="card-${i}">
      <div class="flex" style="justify-content: space-between;">
        <span class="tag ${esc(c.category)}">${esc(c.category)}</span>
        <span class="score-badge">${Math.round(c.score * 100)}% match</span>
      </div>
      <div class="candidate-values">
        ${c.values.map((v, j) => `<span class="tag ${esc(c.category)} ${j === 0 ? "selected" : ""}" onclick="selectCanonical(${i}, ${j})" data-idx="${j}">${esc(v)}</span>`).join('<span style="color:#999;">~</span>')}
      </div>
      <div id="openalex-${i}" class="openalex-hint"></div>
      <div class="candidate-actions">
        <button onclick="confirmMerge(${i})">Merge</button>
        <button class="secondary" onclick="dismissPair(${i})">Not the same</button>
      </div>
    </div>
  `).join("");
  candidates.forEach((c, i) => { if (c.category === "institution") fetchOpenAlexHint(c, i); });
}

function selectCanonical(cardIdx, valIdx) {
  const card = document.getElementById(`card-${cardIdx}`);
  card.querySelectorAll(".tag[data-idx]").forEach((el, j) => {
    el.classList.toggle("selected", j === valIdx);
  });
  candidates[cardIdx]._selectedIdx = valIdx;
}

async function confirmMerge(idx) {
  const c = candidates[idx];
  const selIdx = c._selectedIdx || 0;
  const canonical = c.values[selIdx];
  const variants = c.values.filter((_, i) => i !== selIdx);
  for (const variant of variants) {
    await fetch("/api/tag-stats?action=confirm", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: c.category, variant, canonical }),
    });
  }
  candidates.splice(idx, 1);
  renderCandidates();
  document.getElementById("scan-status").textContent = `Merged! ${candidates.length} remaining`;
}

async function dismissPair(idx) {
  const c = candidates[idx];
  await fetch("/api/tag-stats?action=dismiss", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category: c.category, valueA: c.values[0], valueB: c.values[1] }),
  });
  candidates.splice(idx, 1);
  renderCandidates();
}

async function fetchOpenAlexHint(c, idx) {
  try {
    const resp = await fetch(`https://api.openalex.org/institutions?search=${encodeURIComponent(c.values[0])}&per_page=1`);
    const data = await resp.json();
    const inst = data.results?.[0];
    if (inst) {
      document.getElementById(`openalex-${idx}`).textContent =
        `OpenAlex suggests: "${inst.display_name}" (ROR: ${inst.ror || "none"})`;
    }
  } catch (_) {}
}

function switchTab(tab, btn) {
  document.querySelectorAll(".tab-bar button").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  document.getElementById("candidates-tab").style.display = tab === "candidates" ? "" : "none";
  document.getElementById("active-tab").style.display = tab === "active" ? "" : "none";
  document.getElementById("filter-bar").style.display = tab === "candidates" ? "" : "none";
  if (tab === "active") loadSynonyms();
}

async function loadSynonyms() {
  const resp = await fetch("/api/tag-stats?action=synonyms");
  synonyms = await resp.json();
  renderSynonyms();
}

function renderSynonyms() {
  const el = document.getElementById("active-tab");
  if (!synonyms.length) {
    el.innerHTML = '<div class="card"><span class="text-muted">No synonyms configured yet.</span></div>';
    return;
  }
  el.innerHTML = synonyms.map(s => `
    <div class="synonym-row">
      <span class="tag ${esc(s.category)}">${esc(s.category)}</span>
      <span>${esc(s.variant)}</span>
      <span class="arrow">&rarr;</span>
      <strong>${esc(s.canonical)}</strong>
      <span class="text-small text-muted">(${esc(s.source)})</span>
      <button class="secondary" style="margin-left:auto;font-size:12px;padding:2px 8px;" onclick="removeSynonym(${s.id})">Remove</button>
    </div>
  `).join("");
}

async function removeSynonym(id) {
  await fetch(`/api/tag-stats?action=delete-synonym&id=${id}`, { method: "DELETE" });
  await loadSynonyms();
}

window.loadCandidates = loadCandidates;
window.switchTab = switchTab;
window.selectCanonical = selectCanonical;
window.confirmMerge = confirmMerge;
window.dismissPair = dismissPair;
window.removeSynonym = removeSynonym;
loadCandidates();
})();
