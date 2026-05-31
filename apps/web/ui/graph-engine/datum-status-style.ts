/**
 * The SINGLE place "what a datum's status looks like" is decided.
 *
 * A Governor/Composer stamps a `DatumStatus` on atoms ("this is a
 * forecast"); folding aggregates it per bucket; families read the
 * resolved style here. Change a row in `STYLE` and every chart in every
 * app restyles — "what the data is" lives in the data, "how it looks"
 * lives in this table.
 *
 * Three orthogonal visual channels:
 *   - dash   : polyline stroke pattern (undefined ⇒ solid)
 *   - marker : per-point dot treatment for line/area families
 *   - rect   : bar fill treatment (bars can't dash a stroke)
 * Gaps are NOT here — a gap comes from `value == null` (missing data),
 * an orthogonal axis: a bucket can be projected AND missing.
 */

import type { DatumStatus } from '../../architect/fold-atoms.js';
import type { GraphDirective } from '../../architect/graph-composer.types.js';
export { mergeStatus } from '../../architect/fold-atoms.js';

export interface StatusStyle {
    /** Polyline dash `[on, off]` px; undefined ⇒ solid. */
    dash?: [number, number];
    /** Per-point marker treatment (line/area families). */
    marker: 'filled' | 'hollow' | 'none';
    /** Bar fill treatment — `opacity` multiplies the rect alpha so a
     *  projected bar reads as "not yet real". undefined ⇒ solid. */
    rect?: { opacity: number };
}

/* Frozen module constant — never allocated per frame. */
const STYLE: Readonly<Record<DatumStatus, StatusStyle>> = Object.freeze({
    observed:  { marker: 'filled' },
    projected: { dash: [5, 4], marker: 'none',   rect: { opacity: 0.45 } },
    partial:   { dash: [2, 3], marker: 'hollow', rect: { opacity: 0.45 } },
    estimated: { marker: 'hollow', rect: { opacity: 0.6 } },
});

const OBSERVED: StatusStyle = STYLE.observed;

/** Resolve a status to its visual style. Absent ⇒ observed (solid). */
export function statusStyle(s: DatumStatus | undefined): StatusStyle {
    return s ? STYLE[s] : OBSERVED;
}

/** Chart-wide raw style override — bypasses the semantic table for
 *  pure-aesthetic callers (a dashed target line, brand styling). */
export interface PresentationOverride {
    dash?: [number, number];
    markers?: 'filled' | 'hollow' | 'none';
}

/** Resolve the effective style for one bucket. Override order (first
 *  wins): chart-wide `presentation` ▷ folded bucket `status` ▷ observed.
 *  (`statusOverrides` by index/key are applied by `resolveStatuses`
 *  before this, by substituting the bucket's status.) */
export function resolveBucketStyle(
    status: DatumStatus | undefined,
    presentation?: PresentationOverride,
): StatusStyle {
    const base = statusStyle(status);
    if (!presentation) return base;
    return {
        dash: presentation.dash ?? base.dash,
        marker: presentation.markers ?? base.marker,
        rect: base.rect,
    };
}

/** Apply the directive's per-bucket `statusOverrides` (by folded index
 *  or bucketKey) on top of each bucket's folded status. Returns the
 *  effective `DatumStatus[]`. Pure; called once per `sample()`. `keys`
 *  is the per-bucket key (bucketKey/startISO); omit for index-only. */
export function resolveStatuses(
    folded: ReadonlyArray<DatumStatus>,
    overrides: GraphDirective['statusOverrides'],
    keys?: ReadonlyArray<string>,
): DatumStatus[] {
    if (!overrides) return folded as DatumStatus[];
    const { byIndex, byKey } = overrides;
    return folded.map((s, i) => {
        const k = keys?.[i];
        const byK = k ? byKey?.[k] : undefined;
        return byK ?? byIndex?.[i] ?? s;
    });
}
