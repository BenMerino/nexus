// The ONE search-matching engine shared by every search surface (public
// omnibox, explore records, academic picker). All three previously used a
// single whole-phrase ILIKE — accent-sensitive and order-sensitive. This
// builds the better version once:
//   • tokenized   — whitespace-split; each token must match (any order)
//   • accent-fold — "Gonzalez" matches "González", "energia" matches "energía"
//   • multi-column — a token matches if ANY listed column contains it
//
// Folding without the unaccent extension (Railway's managed role may lack
// CREATE EXTENSION; adding one is a boot risk): translate() the diacritics in
// this corpus to ASCII on the column, NFD-strip the token JS-side. The fold
// rule mirrors org-units.nameKey so search and roster keying agree.

const MAX_TOKENS = 6; // ignore pathological many-word queries

// Accented source chars and ASCII targets, position-aligned (lower then upper).
// translate() is 1:1 per char, single-codepoint forms only — enough for the
// Spanish/Portuguese names + terms actually stored.
const FROM = "áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ";
const TO   = "aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC";

/** SQL fragment: a text expression with its diacritics folded to ASCII. */
function foldExpr(expr) {
  return `translate(${expr}, '${FROM}', '${TO}')`;
}

/** Fold a query term the same way, JS-side (NFD decompose + strip combining
 *  marks) — matches org-units.nameKey so the two never drift. */
function foldTerm(s) {
  return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Build a tokenized, accent-folded, multi-column WHERE clause for positional
 *  sql.query. Each whitespace token must match (AND); a token matches if ANY
 *  column ILIKEs it (OR). Params are numbered from `startIdx`.
 *  Returns { sql, params } — sql is "" when the query has no usable token
 *  (caller treats that as "match nothing" / empty result). */
function matchClause(cols, q, startIdx) {
  const tokens = String(q || "").trim().split(/\s+/).filter(Boolean).slice(0, MAX_TOKENS);
  if (!tokens.length) return { sql: "", params: [] };
  const params = tokens.map((t) => `%${foldTerm(t)}%`);
  const folded = cols.map(foldExpr);
  // token i (param $startIdx+i) → (foldedColA ILIKE $n OR foldedColB ILIKE $n …)
  const perToken = tokens.map((_, i) => {
    const ph = `$${startIdx + i}`;
    return `(${folded.map((f) => `${f} ILIKE ${ph}`).join(" OR ")})`;
  });
  return { sql: perToken.join(" AND "), params };
}

module.exports = { foldExpr, foldTerm, matchClause, MAX_TOKENS };
