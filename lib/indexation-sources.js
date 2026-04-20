const scielo = require("./seeders/scielo-articlemeta");
const scopus = require("./seeders/scopus-elsevier");

const SOURCES = [
  { id: "Scopus", seedKind: "auto", aliases: ["scopus"], seedFn: scopus.seed },
  { id: "WoS", seedKind: "openalex", aliases: ["wos", "web of science"], seedFn: null },
  { id: "SciELO", seedKind: "auto", aliases: ["scielo"], seedFn: scielo.seed },
  { id: "DOAJ", seedKind: "openalex", aliases: ["doaj", "directory of open access journals"], seedFn: null },
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
