// Accent-folding for search WITHOUT the unaccent extension (Railway's managed
// Postgres role may lack CREATE EXTENSION privileges, and adding one is a deploy
// risk). `foldExpr(col)` wraps a text column in a translate() that maps the
// Latin diacritics that occur in this corpus (Spanish + Portuguese names and
// terms) to their ASCII base, so "Gonzalez" matches "González" and "energia"
// matches "energía". `foldTerm` does the same fold JS-side (NFD strip, the same
// rule as org-units.nameKey) for the query token. Compare folded-vs-folded.

// Accented source chars and their ASCII targets, position-aligned (lower then
// upper). translate() is 1:1 per char, so ligature-free single-codepoint forms
// only — enough for the names/titles actually stored.
const FROM = "áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ";
const TO   = "aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC";

/** SQL fragment: the column with its diacritics folded to ASCII. */
function foldExpr(col) {
  return `translate(${col}, '${FROM}', '${TO}')`;
}

/** Fold a query term the same way, JS-side (NFD decompose + strip combining
 *  marks). Matches org-units.nameKey so search folding and roster keying agree. */
function foldTerm(s) {
  return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
}

module.exports = { foldExpr, foldTerm };
