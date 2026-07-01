// Funding-source catalog + CLP formatter for the Projects page. Was an IIFE in
// proyectos.html; hoisted to a re-runnable mount() (legacy-mount.ts contract)
// so spa/ProjectsPage.tsx can drive registration on every React mount. The body
// only (re)assigns window.* globals (used by the other claustro modules), which
// is idempotent — no per-mount DOM work, so mount() returns no cleanup.
export function mount() {
  var FUNDING_SOURCES = [
    { id: "fondecyt-regular",    name: "Fondecyt Regular",        external: true,  concursable: true,  agency: "ANID" },
    { id: "fondecyt-iniciacion", name: "Fondecyt Iniciación",     external: true,  concursable: true,  agency: "ANID" },
    { id: "fondecyt-postdoc",    name: "Fondecyt Postdoctorado",  external: true,  concursable: true,  agency: "ANID" },
    { id: "fondef",              name: "FONDEF IDeA",             external: true,  concursable: true,  agency: "ANID" },
    { id: "fondap",              name: "FONDAP",                  external: true,  concursable: true,  agency: "ANID" },
    { id: "milenio",             name: "Iniciativa Milenio",      external: true,  concursable: true,  agency: "ANID" },
    { id: "anillos",             name: "Anillos ANID",            external: true,  concursable: true,  agency: "ANID" },
    { id: "corfo",               name: "CORFO",                   external: true,  concursable: true,  agency: "CORFO" },
    { id: "fia",                 name: "FIA",                     external: true,  concursable: true,  agency: "FIA" },
    { id: "vrid",                name: "Internal VRID (UTalca)",  external: false, concursable: true,  agency: "UTalca" },
    { id: "extension",           name: "Outreach / Engagement",   external: false, concursable: false, agency: "UTalca" },
    { id: "contrato-empresa",    name: "Company contract",        external: true,  concursable: false, agency: "Private" },
    { id: "consultoria",         name: "Consulting",              external: true,  concursable: false, agency: "Private" },
    { id: "otro",                name: "Other",                   external: false, concursable: false, agency: "—" },
  ];

  function byId(id) {
    for (var i = 0; i < FUNDING_SOURCES.length; i++) if (FUNDING_SOURCES[i].id === id) return FUNDING_SOURCES[i];
    return null;
  }

  function findByName(name) {
    if (!name) return null;
    var lower = String(name).toLowerCase();
    for (var i = 0; i < FUNDING_SOURCES.length; i++) {
      if (FUNDING_SOURCES[i].name.toLowerCase() === lower) return FUNDING_SOURCES[i];
    }
    return null;
  }

  function fmtCLP(n) {
    if (!n) return "$0";
    var num = Number(n);
    if (!Number.isFinite(num)) return "$0";
    return "$" + num.toLocaleString("es-CL");
  }

  window.FUNDING_SOURCES = FUNDING_SOURCES;
  window.fundingById = byId;
  window.fundingByName = findByName;
  window.fmtCLP = fmtCLP;
}
