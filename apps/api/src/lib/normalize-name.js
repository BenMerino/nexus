// String normalization for fuzzy tag matching
// Strips accents, prefixes, punctuation → produces a canonical key

const PREFIXES = [
  "university of", "universidad de", "universidade de", "université de",
  "universität", "universita di", "universiteit van",
  "the ", "la ", "el ", "los ", "las ",
  "pontificia ", "pontifical ",
  "instituto de", "institute of", "institut für",
];

function stripAccents(s) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeKey(value) {
  let s = stripAccents(value).toLowerCase().trim();
  for (const p of PREFIXES) {
    if (s.startsWith(p)) { s = s.slice(p.length).trim(); break; }
  }
  s = s.replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  return s;
}

function similarity(a, b) {
  const ka = normalizeKey(a);
  const kb = normalizeKey(b);
  if (ka === kb) return 1.0;
  if (ka.includes(kb) || kb.includes(ka)) return 0.85;
  return dice(ka, kb);
}

function dice(a, b) {
  if (a.length < 2 || b.length < 2) return 0;
  const bigrams = (s) => {
    const set = new Map();
    for (let i = 0; i < s.length - 1; i++) {
      const bi = s.slice(i, i + 2);
      set.set(bi, (set.get(bi) || 0) + 1);
    }
    return set;
  };
  const ba = bigrams(a), bb = bigrams(b);
  let overlap = 0;
  for (const [k, v] of ba) overlap += Math.min(v, bb.get(k) || 0);
  return (2 * overlap) / (a.length - 1 + b.length - 1);
}

module.exports = { normalizeKey, similarity, stripAccents };
