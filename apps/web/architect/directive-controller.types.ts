import type { BaseQuery, ReplayableDirective } from './replayable-directive.js';

/* ── DirectiveController contract ────────────────────────────
 * The public surface of `useDirectiveController`, extracted so the hook
 * file stays under the N5 line cap. `DirectiveChart` (and any future
 * caller) types against this.
 * ──────────────────────────────────────────────────────────── */

export interface DirectiveController<TDirective extends ReplayableDirective<TQuery>, TQuery extends BaseQuery> {
    directive: TDirective;
    isLoading: boolean;
    error: string | null;
    /** True when receiving Stream pushes (a StreamBridge is connected and
     *  has sent a value). False on the HTTP recompose fallback path. */
    isLive: boolean;
    setToggle: (toggleId: string, value: string) => void;
    /** Commit one or more query fields in a single recompose (sliders/date
     *  pickers, or coupled fields like windowDays + asOf together). */
    setQueryFields: (patch: Partial<TQuery>) => void;
    refetch: () => void;
    /** Drill to a child query; pushes the current directive onto the
     *  breadcrumb stack so drillUp restores it without a refetch. */
    drillDown: (childQuery: TQuery, breadcrumbLabel: string) => void;
    drillUp: () => void;
    breadcrumbs: { label: string }[];
}
