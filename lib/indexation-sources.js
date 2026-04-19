const SOURCES = [
  { id: "Scopus", seedKind: "manual", aliases: ["scopus"] },
  { id: "WoS", seedKind: "manual", aliases: ["wos", "web of science"] },
  { id: "SciELO", seedKind: "auto", aliases: ["scielo"] },
  { id: "DOAJ", seedKind: "auto", aliases: ["doaj", "directory of open access journals"] },
];

const BY_ALIAS = (() => {
  const m = new Map();
  for (const s of SOURCES) {
    m.set(s.id.toLowerCase(), s.id);
    for (const a of s.aliases) m.set(a, s.id);
  }
  return m;
})();

function canonicalSource(raw) {
  const k = String(raw || "").trim().toLowerCase();
  return BY_ALIAS.get(k) || null;
}

function listSourceIds() {
  return SOURCES.map(s => s.id);
}

function getSource(id) {
  return SOURCES.find(s => s.id === canonicalSource(id)) || null;
}

module.exports = { SOURCES, canonicalSource, listSourceIds, getSource };
