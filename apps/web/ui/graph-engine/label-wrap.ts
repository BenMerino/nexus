/**
 * Word-wrap for categorical x-axis labels. Sibling of `label-abbreviate`
 * (which folds a label to INITIALS) and `label-decimate` (which drops WHICH
 * labels show): this stacks a kept label onto multiple upright lines, the
 * bar's slot width deciding the breaks. A named entity reads as
 *     Universidad        (wide slot)      Universidad   (narrow slot)
 *     de Talca                            de
 *                                         Talca
 * instead of being rotated -40°. Used only on the keepAll (categorical)
 * path; temporal axes never wrap.
 *
 * The elegant rule: keep REAL WORDS, let the slot decide. Greedy pack as
 * many whole words as fit `budgetChars` per line; break otherwise. Only a
 * single word that ALONE overruns the slot is ellipsised (mid-word cuts
 * read worse than a clipped tail, but an un-split 20-char word would blow
 * the column). Total lines cap at MAX_LINES so a pathological label can't
 * grow the axis band without bound — the last line ellipsises the rest.
 */

import { ellipsiseWord } from './label-abbreviate.js';

const MAX_LINES = 3;

export function wrapLabel(text: string, budgetChars: number): string[] {
    const words = text.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return [''];
    const budget = Math.max(1, budgetChars);
    const lines: string[] = [];
    let cur = '';
    for (let wi = 0; wi < words.length; wi++) {
        const w = words[wi];
        if (cur === '') {
            cur = w;
        } else if (cur.length + 1 + w.length <= budget) {
            cur = `${cur} ${w}`;
        } else {
            lines.push(cur);
            cur = w;
            /* On the last allowed line, absorb every remaining word and
             *  ellipsise the whole tail to the budget — no more breaks. */
            if (lines.length === MAX_LINES - 1) {
                cur = words.slice(wi).join(' ');
                break;
            }
        }
    }
    if (cur) lines.push(cur);
    /* A single word wider than the slot (e.g. "Universidad" in a 9-char
     *  slot) is ellipsised per-line so it can't overrun the column. */
    return lines.map(ln => ln.length > budget ? ellipsiseWord(ln, budget) : ln);
}
