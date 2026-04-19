const STOPWORDS = new Set([
  "a","an","the","and","or","but","if","then","else","of","at","by","for","with","about",
  "against","between","into","through","during","before","after","above","below","to","from",
  "up","down","in","out","on","off","over","under","again","further","is","are","was","were",
  "be","been","being","have","has","had","having","do","does","did","doing","this","that",
  "these","those","i","you","he","she","it","we","they","them","their","our","its","his",
  "her","my","your","not","no","nor","so","than","too","very","can","will","just","should",
  "now","also","such","more","most","some","any","all","each","both","other","than","while",
  "however","therefore","thus","using","used","use","based","study","paper","results","show",
  "shown","method","methods","approach","approaches","present","propose","proposed","new",
  "novel","data","analysis","model","models","one","two","three"
]);

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function tokenize(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s\-]/g, " ").split(/\s+/).filter(Boolean);
}

function extractKeywords(abstract, max = 8) {
  if (!abstract || abstract.length < 40) return [];
  const sentences = abstract.split(/[.!?;\n]+/);
  const phrases = [];
  for (const s of sentences) {
    const tokens = tokenize(s);
    let cur = [];
    for (const t of tokens) {
      if (STOPWORDS.has(t) || t.length < 3) {
        if (cur.length) { phrases.push(cur); cur = []; }
      } else {
        cur.push(t);
      }
    }
    if (cur.length) phrases.push(cur);
  }
  // RAKE-style word scoring: deg(w) / freq(w)
  const freq = new Map(), deg = new Map();
  for (const p of phrases) {
    const len = p.length;
    for (const w of p) {
      freq.set(w, (freq.get(w) || 0) + 1);
      deg.set(w, (deg.get(w) || 0) + (len - 1));
    }
  }
  const wordScore = new Map();
  for (const [w, f] of freq) wordScore.set(w, ((deg.get(w) || 0) + f) / f);
  // Phrase score = sum of word scores; keep multi-word phrases preferentially
  const scored = new Map();
  for (const p of phrases) {
    if (p.length === 0 || p.length > 4) continue;
    const phrase = p.join(" ");
    const score = p.reduce((s, w) => s + (wordScore.get(w) || 0), 0);
    const prev = scored.get(phrase) || 0;
    if (score > prev) scored.set(phrase, score);
  }
  const maxScore = Math.max(1, ...scored.values());
  const sorted = [...scored.entries()].sort((a, b) => b[1] - a[1]).slice(0, max);
  return sorted.map(([phrase, score]) => ({
    id: "kw:" + slug(phrase),
    display_name: phrase,
    source: "nlp",
    level: null,
    score: score / maxScore,
  })).filter(k => k.id !== "kw:");
}

module.exports = { extractKeywords };
