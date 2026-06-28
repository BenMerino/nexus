import { eligibleFoldUnits } from '../../architect/fold-atoms.js';
import type { ToggleSpec } from '../../architect/replayable-directive.js';
import type { GraphQuery } from '../../architect/graph-composer.types.js';

/* Strip a foldUnit toggle's options down to the units that bucket READABLY
 * for the current visible span (eligibleFoldUnits: 3–120 buckets). Without
 * this a user could force e.g. "week" over a 170-year window → ~9k buckets,
 * crippling the fold/render. Non-foldUnit toggles pass through untouched, and
 * a foldUnit toggle keeps 'auto' (always eligible) plus whatever fits — so the
 * fine rungs reappear as the user narrows the window.
 *
 * A non-finite span is genuinely unknown → don't gate (pass through). But a
 * span of 0 (or negative) is a KNOWN-EMPTY view — a window/period forced onto
 * a range with no data: there every concrete unit (day/week/month/…) would
 * produce zero buckets, so `eligibleFoldUnits(0)` correctly collapses to just
 * 'auto'. Letting 0 flow through is what blocks the nonsensical granularities
 * on an empty forced view (previously `<= 0` bailed and showed them all). */
export function gateFoldUnitToggles<T extends ToggleSpec<GraphQuery>>(toggles: T[], visibleDays: number): T[] {
    if (!Number.isFinite(visibleDays)) return toggles;
    const eligible = new Set(eligibleFoldUnits(Math.max(0, visibleDays)).map(String));
    return toggles.map(tg => {
        if (tg.field !== 'foldUnit' && tg.id !== 'foldUnit') return tg;
        const options = tg.options.filter(o => eligible.has(o.value));
        return { ...tg, options } as T;
    });
}
