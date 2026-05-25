import type { BaseQuery, ReplayableDirective, ToggleSpec, ToggleValueType } from './replayable-directive.js';

/** Coerce a pill's string value to the runtime type the query field
 * expects. Defaults to string when `valueType` is absent. The literal
 * pill value `'null'` maps to `null` for nullable types — used by
 * sentinel pills like "All" → `windowDays = null`. */
function coerceToggleValue(value: string, valueType: ToggleValueType | undefined): unknown {
    if (valueType === 'number') return Number(value);
    if (valueType === 'numberOrNull') return value === 'null' ? null : Number(value);
    return value;
}

/* ── Directive Controller — Pure Logic ──────────────────────
 * The non-React core of `useDirectiveController`. Extracting these as
 * pure functions lets the controller hook stay a thin React shell over
 * tested primitives. node:test covers the logic; the hook itself is
 * orchestration (useState, useEffect) over these.
 * ──────────────────────────────────────────────────────────── */

export type ToggleValues = Record<string, string>;

/** Apply persisted toggle values onto a fresh query. Persisted wins over
 * defaults so a returning user sees their last selection without a flash
 * of the default first. Drops persisted values that aren't in the
 * directive's current options list (e.g. removed toggle option). */
export function applyPersisted<TQuery extends BaseQuery>(
    query: TQuery,
    toggles: ReplayableDirective<TQuery>['toggles'] | undefined,
    persisted: ToggleValues | null,
): TQuery {
    if (!persisted || !toggles) return query;
    const next = { ...query } as Record<string, unknown>;
    for (const t of toggles) {
        const v = persisted[t.id];
        if (!v) continue;
        if (t.options.some(o => o.value === v)) {
            next[t.field] = coerceToggleValue(v, (t as ToggleSpec).valueType);
        }
    }
    return next as TQuery;
}

/** Deep-equal two queries by `kind` + `tenantId` + every other field.
 * Used to decide whether a parent prop refresh is meaningfully new state
 * or just a reference churn. Conservative: if either side has extra keys,
 * returns false. */
export function sameQuery(a: BaseQuery, b: BaseQuery): boolean {
    if (a.kind !== b.kind || a.tenantId !== b.tenantId) return false;
    const ar = a as unknown as Record<string, unknown>;
    const br = b as unknown as Record<string, unknown>;
    const ka = Object.keys(ar), kb = Object.keys(br);
    if (ka.length !== kb.length) return false;
    for (const k of ka) {
        if (ar[k] !== br[k]) return false;
    }
    return true;
}

/** Apply a toggle change to a query. Looks up the toggle by id, validates
 * the chosen value is one of its options, mutates the query field. Returns
 * the same query object reference when no change applies (unknown toggle
 * or invalid value) — caller can use identity check to detect no-op. */
export function applyToggleToQuery<TQuery extends BaseQuery>(
    query: TQuery,
    toggles: ReplayableDirective<TQuery>['toggles'] | undefined,
    toggleId: string,
    value: string,
): TQuery {
    const tog = toggles?.find(t => t.id === toggleId);
    if (!tog) return query;
    if (!tog.options.some(o => o.value === value)) return query;
    return { ...query, [tog.field]: coerceToggleValue(value, (tog as ToggleSpec).valueType) } as TQuery;
}

/** Merge a single toggle change into the persisted map. Pure mirror of the
 * mutation that gets written to localStorage. */
export function nextPersisted(persisted: ToggleValues, toggleId: string, value: string): ToggleValues {
    return { ...persisted, [toggleId]: value };
}

/** Visible-window query fields. Patches that touch ONLY these fields can
 *  be handled without a server recompose for atomic directives — the
 *  client slices/folds atoms on the fly. Anything outside this set
 *  (kind, tenantId, granularity overrides, ...) requires a recompose. */
const VISIBLE_WINDOW_FIELDS = new Set(['windowDays', 'asOf']);

/** Whether a setQueryFields patch can be served entirely client-side
 *  for an atomic directive. Pure: no React, no async. */
export function isAtomicVisibleWindowPatch(
    directive: { atoms?: unknown[] | undefined },
    patchKeys: string[],
): boolean {
    if (directive.atoms === undefined) return false;
    return patchKeys.every(k => VISIBLE_WINDOW_FIELDS.has(k));
}
