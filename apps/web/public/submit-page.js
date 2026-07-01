// Submit-DOI page logic. This was the inline <script> IIFE inside submit.html;
// hoisted into a re-runnable, named mount() for the React Router page
// (spa/SubmitPage.tsx) per the legacy-mount.ts contract. mount() re-queries the
// DOM and re-binds on every React mount; window.submit stays assigned so the
// inline onclick="submit()" in the ported markup keeps resolving.
//
// mount() returns a cleanup that removes the keydown listener it bound, so
// remounts on client-side nav don't stack duplicate handlers.

async function submit() {
  const doi = document.getElementById("doi-input").value.trim();
  if (!doi) { alert("Enter a DOI"); return; }

  const status = document.getElementById("status");
  const results = document.getElementById("results");
  status.className = "status loading";
  status.textContent = "Checking DOI across CrossRef, OpenAlex, Semantic Scholar, DataCite…";
  results.innerHTML = "";

  try {
    const resp = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doi }),
    });
    if (resp.status === 401) { window.location.href = "/login.html"; return; }
    const data = await resp.json();
    if (data.error) {
      status.className = "status error";
      status.textContent = "Error: " + data.error;
      return;
    }
    status.className = "status success";
    status.textContent = "Done. Record stored in database.";
    results.innerHTML = renderNormalized(data.record) + renderTags(data.tags) + renderSources(data.sources);
  } catch (err) {
    status.className = "status error";
    status.textContent = "Error: " + err.message;
  }
}

function renderNormalized(r) {
  const fields = [
    ["doi", r.doi], ["title", r.title], ["authors", r.authors?.map(a => a.name || a).join(", ")],
    ["published", r.published], ["journal", r.journal], ["publisher", r.publisher],
    ["type", r.type], ["citations", r.citationCount], ["openAccess", r.openAccess],
    ["openAccessUrl", r.openAccessUrl], ["venue", r.venue], ["url", r.url],
  ];
  const rows = fields.filter(([, v]) => v != null && v !== "").map(([k, v]) => {
    let val = v;
    if (typeof val === "string" && val.startsWith("http")) val = `<a href="${val}" target="_blank">${val}</a>`;
    if (typeof val === "boolean") val = val ? "Yes" : "No";
    return `<tr><td>${k}</td><td>${val}</td></tr>`;
  }).join("");
  return `<div class="normalized"><h3>Normalized record</h3><table>${rows}</table></div>`;
}

function renderTags(tags) {
  return '<div class="card mt-16"><h3>Extracted tags</h3><div class="mt-8">'
    + tags.map(t => `<span class="tag ${t.category}">${t.category}: ${t.value}</span>`).join(" ")
    + '</div></div>';
}

function renderSources(sources) {
  const names = ["crossref", "openalex", "semanticScholar", "datacite"];
  let html = '<h2 class="mt-16" style="font-family: var(--display); font-weight: 400; margin-top: 24px;">Raw API responses</h2>';
  html += names.map(s => {
    const d = sources[s];
    if (!d || !d.found) return `<div class="source"><h3>${s}</h3><span class="not-found">Not found</span></div>`;
    const rows = Object.entries(d).filter(([k, v]) => k !== "found" && v != null && v !== "").map(([k, v]) => {
      let val = Array.isArray(v) ? v.join(", ") : v;
      if (typeof val === "string" && val.startsWith("http")) val = `<a href="${val}" target="_blank">${val}</a>`;
      if (typeof val === "boolean") val = val ? "Yes" : "No";
      return `<tr><td>${k}</td><td>${val}</td></tr>`;
    }).join("");
    return `<div class="source"><h3>${s}</h3><table>${rows}</table></div>`;
  }).join("");
  return html;
}

function onKeydown(e) {
  if (e.key === "Enter") submit();
}

export function mount() {
  const input = document.getElementById("doi-input");
  window.submit = submit;
  if (!input) return;
  input.addEventListener("keydown", onKeydown);
  return () => { input.removeEventListener("keydown", onKeydown); };
}
