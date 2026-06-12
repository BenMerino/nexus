/**
 * Adaptive column-fold for categorical heatmaps whose column axis is a
 * run of calendar years (e.g. "Publicaciones por tipo": type-rows ×
 * year-columns). When a tenant's span runs 40+ years, every year becomes
 * a hair-thin column with an overlapping label — illegible. This folds
 * the year-columns into decade buckets ("2000s") past a readability
 * threshold, summing each (row, decade) cell.
 *
 * Both `animatedHeatmap.sample` (cells) and `gridChrome` (labels) call
 * this so they fold identically — the labels never disagree with the
 * cells they sit above. Pure; returns the input unchanged when the
 * columns aren't years or aren't crowded.
 *
 * This is the categorical-axis sibling of the calendar `decade` rung
 * added to `fold-atoms` — same intent (collapse year-columns to decades
 * when wide), applied to pre-aggregated cells rather than raw atoms.
 */

interface HeatmapCellLike { row: unknown; col: unknown; value: number; [k: string]: unknown }

/** Above this many distinct year-columns, fold to decades. Picked so a
 *  typical chart width (~360px) keeps each remaining column wide enough
 *  to read its label. Below it, per-year detail is worth keeping. */
const YEAR_COL_FOLD_THRESHOLD = 20;

const YEAR_RE = /^\d{4}$/;

/** Are all columns 4-digit years? Only then is decade-folding meaningful. */
function colsAreYears(cols: string[]): boolean {
    return cols.length > 0 && cols.every(c => YEAR_RE.test(c));
}

/** Fold year-columns to decade buckets when crowded; otherwise identity.
 *  Decade label matches `formatLabel(_, 'decade')` → e.g. `2000s`. */
export function foldHeatmapColumns<T extends HeatmapCellLike>(cells: T[]): T[] {
    const cols = [...new Set(cells.map(d => String(d.col)))];
    if (cols.length <= YEAR_COL_FOLD_THRESHOLD || !colsAreYears(cols)) return cells;

    const decadeOf = (year: string) => `${Math.floor(Number(year) / 10) * 10}s`;
    /* Sum values into (row, decade) buckets. First cell of each bucket
     *  carries the merged spread so any sibling fields (label, status)
     *  follow the canonical decade representative. */
    const merged = new Map<string, T>();
    for (const d of cells) {
        const key = `${String(d.row)}|${decadeOf(String(d.col))}`;
        const existing = merged.get(key);
        if (existing) {
            existing.value += d.value;
            /* Fold the atom-key range too — keeping only the first year's
             *  `__startKey`/`__endKey` would make a click on the decade
             *  cell drill into ONE year instead of ten. */
            if (typeof existing.__startKey === 'number' && typeof d.__startKey === 'number') {
                existing.__startKey = Math.min(existing.__startKey, d.__startKey);
            }
            if (typeof existing.__endKey === 'number' && typeof d.__endKey === 'number') {
                existing.__endKey = Math.max(existing.__endKey, d.__endKey);
            }
        } else {
            merged.set(key, { ...d, col: decadeOf(String(d.col)), value: d.value });
        }
    }
    return [...merged.values()];
}

/** The heatmap's cell-grid geometry — the ONE authority both the
 *  renderer (`animatedHeatmap.sample`) and the chrome builder
 *  (`gridChrome`) read, so cells and their row/column labels share an
 *  origin and pitch BY CONSTRUCTION. They used to duplicate these
 *  constants, and marginal mode (which shrinks the grid for its Σ
 *  strips) was only applied on the renderer side — labels drifted off
 *  their cells by up to a cell-width the moment the Σ toggle flipped.
 *
 *  labelW: left gutter for row-label WORDS (wider than cartesian
 *  y-ticks); labelH: top strip for column labels; PAD_R/PAD_B:
 *  breathing room mirroring cartesian plot margins; marginal mode adds
 *  its 20/12px Σ strips on top of those. */
export function heatmapGridGeometry(width: number, height: number, marginal: boolean) {
    const labelW = 52, labelH = 14;
    const PAD_R = 12, PAD_B = 12;
    const margR = (marginal ? 20 : 0) + PAD_R;
    const margB = (marginal ? 12 : 0) + PAD_B;
    return {
        labelW, labelH, margR, margB,
        gridW: width - labelW - margR,
        gridH: height - labelH - margB,
    };
}
