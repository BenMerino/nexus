/* ── 2D Atomic Fold ─────────────────────────────────────────
 * Two-dimensional sibling of `foldByCalendar`. Given a stream
 * of atoms and a `(rowUnit, colUnit)` pair from the calendar
 * ladder (hour < day < week < month < quarter < year), projects
 * the atoms into a row×col grid where each cell is the aggregate
 * of all atoms whose timestamp falls into that (row, col) pair.
 *
 * Used by the heatmap family — same atoms that drive bar/area/line
 * charts produce the heatmap grid via this fold. Different chart
 * family, same mathematical substrate, same windowing math.
 * ──────────────────────────────────────────────────────────── */

import { stepByUnit, alignToUnitStart, formatLabel } from './fold-atoms-calendar';
import { HOURS_PER_DAY } from './fold-atoms';
import type { Atom, FoldUnit, Aggregator } from './fold-atoms';

/** One cell in the row×col grid. `value` aggregates the atoms whose
 *  timestamp factors into `(row, col)`. `startKey`/`endKey` reference
 *  the canonical 1D atom timeline so the heatmap renderer can clip
 *  to the visible slider window the same way cartesian charts do. */
export interface GridBucket {
    row: string;
    col: string;
    value: number;
    count: number;
    /** Hour-resolution atom-key range this cell covers. For composite
     *  cells (e.g. "Mon × 09:00" across multiple weeks), the range is
     *  the convex hull — first contributing atom to last. */
    startKey: number;
    endKey: number;
    [seriesKey: string]: string | number | undefined;
}

/** Pick a default `(rowUnit, colUnit)` pair for the visible span.
 *  Mirrors `pickAutoFoldUnit`'s ~30-bucket target but in 2D: roughly
 *  7×24 = 168 cells at the narrowest zoom, scaling down as the window
 *  widens.
 *
 *    span ≤ 14d    → day × hour     (Busy Hours — current heatmap)
 *    span ≤ 90d    → week × day     (this quarter, pattern by weekday)
 *    span ≤ 400d   → month × day    (this year, day-of-month grid)
 *    span ≤ 40y    → year × month   (multi-year roll-up)
 *    otherwise     → decade × year  (multi-decade roll-up — keeps the
 *                                    column count readable when a span
 *                                    runs 40+ years)
 *
 *  Both axes obey the unit ladder; coarser-than-row col never appears.
 *  `hasHourly` gates the finest pair — daily-only atoms get the day×week
 *  pair at the narrowest zoom instead. */
export function pickAutoUnitPair(visibleDays: number, hasHourly: boolean = false): [Exclude<FoldUnit, 'auto'>, Exclude<FoldUnit, 'auto'>] {
    if (hasHourly && visibleDays <= 14) return ['day', 'hour'];
    if (visibleDays <= 90) return ['week', 'day'];
    if (visibleDays <= 400) return ['month', 'day'];
    if (visibleDays <= 365 * 40) return ['year', 'month'];
    return ['decade', 'year'];
}

/** Calendar-aligned 2D fold. Walks rowUnit boundaries; inside each
 *  row, walks colUnit boundaries; aggregates atoms in each cell.
 *
 *  Atom assignment: each atom's `(iso, hour ?? 0)` is converted to a
 *  Date, then asked "which (rowUnit, colUnit) cell?" The row is the
 *  calendar bucket at rowUnit alignment; the col is the colUnit-aligned
 *  *position within the row*. So "month × day" means: row = month
 *  (Mar, Apr, ...), col = day-of-month (01..31).
 *
 *  Pure. */
export function foldByCalendarGrid(
    atoms: Atom[],
    rowUnit: Exclude<FoldUnit, 'auto'>,
    colUnit: Exclude<FoldUnit, 'auto'>,
    aggregator: Aggregator,
    _seriesKeys: string[] = [],
): GridBucket[] {
    if (atoms.length === 0) return [];
    const firstISO = atoms[0].iso;
    const lastISO = atoms[atoms.length - 1].iso;
    if (!firstISO || !lastISO) return [];

    /* Enumerate row labels (rowUnit-aligned spans across the timeline)
     *  and col labels (colUnit-aligned spans WITHIN one rowUnit window).
     *  Cells are the cartesian product; cell labels are the formatLabel
     *  outputs. */
    const firstD = new Date(`${firstISO}T00:00:00Z`);
    const lastD = new Date(`${lastISO}T00:00:00Z`);
    const after = new Date(lastD); after.setUTCDate(after.getUTCDate() + 1);

    const rowLabels: string[] = [];
    /* Cell-identity key for grid lookups. Distinct from `formatLabel`
     *  (which produces rich display strings) because the display string
     *  for `unit='day'` is `'Sun 01'` — weekday-prefixed and therefore
     *  date-specific. Two atoms on day-of-month 04 in different months
     *  would carry different weekday prefixes ('Wed 04' vs 'Fri 04')
     *  and end up in different cells, even though month×day fold means
     *  to collapse them by day-of-month alone. The cellKey strips the
     *  weekday so cell membership is position-stable; the renderer
     *  reads display strings off `colLabels` for headers, which still
     *  carry the rich weekday context of the first walked month. */
    const cellKeyForUnit = (d: Date, unit: Exclude<FoldUnit, 'auto'>): string => {
        if (unit === 'day') return String(d.getUTCDate()).padStart(2, '0');
        return formatLabel(d, unit);
    };

    /* Context-aware display label for column headers. `formatLabel(_, 'day')`
     *  returns weekday-prefixed strings (`'Sun 01'`) which only make sense
     *  when each column represents a SPECIFIC date — i.e. when the row
     *  axis isolates a particular week/month, so the weekday is constant
     *  within that column. For `month × day` folds, each column collapses
     *  N different months' day-N, so the weekday differs across rows and
     *  putting any single weekday in the header would be a lie. Strip the
     *  weekday in that case; keep it otherwise. */
    const colDisplayLabel = (d: Date): string => {
        if (colUnit === 'day' && (rowUnit === 'month' || rowUnit === 'quarter' || rowUnit === 'year')) {
            return String(d.getUTCDate()).padStart(2, '0');
        }
        return formatLabel(d, colUnit);
    };

    const rowKeys: string[] = [];
    let rCur = alignToUnitStart(firstD, rowUnit);
    while (rCur < after) {
        rowLabels.push(formatLabel(rCur, rowUnit));
        rowKeys.push(cellKeyForUnit(rCur, rowUnit));
        rCur = stepByUnit(new Date(rCur), rowUnit);
    }
    /* Column labels are derived from one full rowUnit window starting at
     *  the first atom's row. This guarantees uniform col labels across
     *  rows even when the data is sparse. */
    const colLabels: string[] = [];
    const colKeys: string[] = [];
    const rowStart = alignToUnitStart(firstD, rowUnit);
    const rowEnd = stepByUnit(new Date(rowStart), rowUnit);
    let cCur = alignToUnitStart(rowStart, colUnit);
    while (cCur < rowEnd) {
        colLabels.push(colDisplayLabel(cCur));
        colKeys.push(cellKeyForUnit(cCur, colUnit));
        cCur = stepByUnit(new Date(cCur), colUnit);
    }

    type CellAgg = { sum: number; count: number; min: number; max: number; first?: number; last?: number; firstKey: number; lastKey: number };
    const cells = new Map<string, CellAgg>();
    const cellKey = (r: string, c: string) => `${r}|${c}`;

    const anchorMs = firstD.getTime();
    for (const a of atoms) {
        if (a.iso == null) continue;
        const d = new Date(`${a.iso}T${String(a.hour ?? 0).padStart(2, '0')}:00:00Z`);
        const rowLabel = cellKeyForUnit(alignToUnitStart(d, rowUnit), rowUnit);
        const colLabel = cellKeyForUnit(alignToUnitStart(d, colUnit), colUnit);
        const k = cellKey(rowLabel, colLabel);
        const atomHourKey = Math.round((d.getTime() - anchorMs) / 3_600_000);
        const cur = cells.get(k);
        const v = a.value ?? 0;
        if (cur) {
            cur.sum += v;
            cur.count += 1;
            if (v < cur.min) cur.min = v;
            if (v > cur.max) cur.max = v;
            cur.last = v; cur.lastKey = atomHourKey;
        } else {
            cells.set(k, { sum: v, count: 1, min: v, max: v, first: v, last: v, firstKey: atomHourKey, lastKey: atomHourKey });
        }
    }

    const out: GridBucket[] = [];
    /* Emit cells keyed by display label (rowLabel, colLabel) so the
     *  renderer can use them as headers, but look up values via the
     *  key-form so weekday-prefixed labels in different months still
     *  resolve to the same cell. */
    for (let ri = 0; ri < rowLabels.length; ri++) {
        for (let ci = 0; ci < colLabels.length; ci++) {
            const agg = cells.get(cellKey(rowKeys[ri], colKeys[ci]));
            const value = agg ? reduce(agg, aggregator) : 0;
            out.push({
                row: rowLabels[ri], col: colLabels[ci], value,
                count: agg?.count ?? 0,
                startKey: agg?.firstKey ?? -1,
                endKey: agg?.lastKey ?? -1,
            });
        }
    }
    return out;
}

function reduce(agg: { sum: number; count: number; min: number; max: number; first?: number; last?: number }, aggregator: Aggregator): number {
    if (aggregator === 'min') return agg.min;
    if (aggregator === 'max') return agg.max;
    if (aggregator === 'first') return agg.first ?? 0;
    if (aggregator === 'last') return agg.last ?? 0;
    if (aggregator === 'wavg') return agg.count === 0 ? 0 : agg.sum / agg.count;
    return agg.sum;
}

/** How many days of resolution does a (rowUnit, colUnit) pair represent
 *  per cell? Used by drill-down to compute the narrowed window when the
 *  user clicks a heatmap cell. */
export function cellSpanDays(rowUnit: Exclude<FoldUnit, 'auto'>, colUnit: Exclude<FoldUnit, 'auto'>): number {
    /* Conservative — cell granularity is dominated by colUnit (faster
     *  axis). One hour cell = 1/24 day; day = 1; etc. */
    void rowUnit;
    if (colUnit === 'hour') return 1 / HOURS_PER_DAY;
    if (colUnit === 'day') return 1;
    if (colUnit === 'week') return 7;
    if (colUnit === 'month') return 30;
    if (colUnit === 'quarter') return 91;
    if (colUnit === 'year') return 365;
    return 3650;
}
