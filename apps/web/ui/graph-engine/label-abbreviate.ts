/**
 * The single authority for "this label is too long to render whole."
 * Sibling of `label-decimate.ts`: decimation drops WHICH labels show,
 * abbreviation shortens the TEXT of the ones that do. Both x-axis,
 * radial callouts, and grid in-rect labels call into this so no family
 * grows its own ad-hoc `slice(0, n) + '…'` that disagrees at the same
 * width.
 *
 * Strategy — initial leading nouns. A multi-word title carries its
 * identity in the TAIL ("Universidad de Talca" is distinguished by
 * "Talca", not "Universidad"). So we collapse leading capitalised
 * content words to `X.` initials, preserve lowercase connectors
 * (de/la/del/the/of/…) verbatim, and keep the final content word
 * intact. Applied progressively until it fits `maxChars`; raw
 * head-truncation with `…` is only the last resort for a single
 * unsplittable word.
 *
 *   "Universidad de Talca"            → "U. de Talca"
 *   "Pontificia Universidad Católica" → "P. U. Católica"
 *   "Talca"                           → "Talca"        (nothing to fold)
 *   "Supercalifragilistic"            → "Supercalifr…" (one word → ellipsis)
 */

/** Lowercase connector words that read as glue, not identity. Kept
 *  verbatim (never initialised) so "U. de Talca" stays grammatical.
 *  Spanish + English + Portuguese — the tenant set in play. */
const CONNECTORS = new Set([
    'de', 'del', 'la', 'las', 'el', 'los', 'y', 'e',
    'da', 'do', 'das', 'dos',
    'the', 'of', 'and', 'for', 'at', 'in',
]);

/** A word is a "title noun" (foldable to an initial) when it is a
 *  content word — not a connector — and starts with a letter. Numbers
 *  and connectors are left whole. */
function isTitleNoun(word: string): boolean {
    if (CONNECTORS.has(word.toLowerCase())) return false;
    return /^\p{L}/u.test(word);
}

/** First grapheme of a word as an uppercase initial + period. Uses the
 *  spread to grab the first CODE POINT, so accented/wide letters survive
 *  ("Ñuñoa" → "Ñ."). */
function initialOf(word: string): string {
    const first = [...word][0] ?? '';
    return first.toUpperCase() + '.';
}

/** Progressive abbreviation toward `maxChars`. Returns the shortest
 *  form that fits, or — if even full folding overruns — the folded
 *  string head-truncated with an ellipsis. `maxChars` ≤ 0 or a string
 *  already short enough is returned unchanged. */
export function abbreviateLabel(text: string, maxChars: number): string {
    const raw = text.trim();
    if (maxChars <= 0 || raw.length <= maxChars) return raw;

    const words = raw.split(/\s+/);
    /* Single word — nothing to fold; fall straight to ellipsis. */
    if (words.length === 1) return ellipsise(raw, maxChars);

    /* Fold leading title nouns to initials one at a time, left to right,
     *  but NEVER fold the last word (it carries the identity). Stop as
     *  soon as the result fits. */
    const out = [...words];
    const lastIdx = words.length - 1;
    for (let i = 0; i < lastIdx; i++) {
        if (!isTitleNoun(words[i])) continue;          // leave connectors/numbers whole
        out[i] = initialOf(words[i]);
        const candidate = out.join(' ');
        if (candidate.length <= maxChars) return candidate;
    }

    const folded = out.join(' ');
    /* Still too long after folding every foldable leading word — the
     *  tail itself is the overrun. Ellipsise the folded form so we keep
     *  the initials rather than the verbose head. */
    return folded.length <= maxChars ? folded : ellipsise(folded, maxChars);
}

/** Head-truncate with a trailing ellipsis, never emitting more than
 *  `maxChars` glyphs. `…` counts as one. Floors at 1 visible glyph.
 *  Exported as `ellipsiseWord` for label-wrap (a single slot-overrun word). */
function ellipsise(text: string, maxChars: number): string {
    if (text.length <= maxChars) return text;
    const keep = Math.max(1, maxChars - 1);
    return text.slice(0, keep) + '…';
}

export { ellipsise as ellipsiseWord };
