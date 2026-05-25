/* ── ReplayableDirective ──────────────────────────────────────
 * Foundation contract: any directive type may opt into being
 * "replayable" — meaning it carries the recipe (query) that produced
 * it, and the client can mutate fields and POST it back to receive
 * a fresh directive.
 *
 * Used by directives whose replay path goes through the unified
 * `POST /api/architect/recompose` endpoint: GraphDirective today,
 * CalendarDirective + RosterDirective when they adopt toggles.
 *
 * Tables are intentionally NOT migrated to this base. TableDirective
 * carries its own `query: TableQuery` (page/sort/filters/search) that
 * replays through per-resource REST endpoints via `useTableQuery`.
 * That machinery is battle-tested; rewiring it would be churn for no
 * gain. Tables and the recompose pattern live as siblings.
 *
 * Directives without `query` are one-shot snapshots — opt-in only.
 * ──────────────────────────────────────────────────────────── */

/** Every replayable query carries a `kind` (selects the server builder)
 * and a `tenantId` (always-required scoping). Specific directive types
 * extend this with their own fields (range, granularity, sort, filters, …). */
export interface BaseQuery {
    kind: string;
    tenantId: string;
}

/** Declarative toggle attached to a directive. Each toggle binds to a
 * field on `query` — flipping the pill mutates `query[field]` and the
 * controller refetches. Generic over the query type so each directive
 * gets type-checked toggle definitions for its own query shape.
 *
 * Pill `value`s are strings (DOM values are strings) but query fields
 * may be other types (numbers, nulls). When the field's runtime type
 * is not `string`, set `valueType` so the controller coerces the
 * pill's string value before writing it to the query. Without this,
 * a pill emitting `'7'` would write the literal string `'7'` into a
 * `number`-typed field — types lie and downstream consumers break. */
export type ToggleValueType = 'string' | 'number' | 'numberOrNull';

export interface ToggleSpec<TQuery extends BaseQuery = BaseQuery> {
    id: string;
    label?: string;
    /** Field on TQuery this toggle controls. Typed so a typo here is
     * a compile error, not a silent runtime no-op. */
    field: keyof TQuery & string;
    options: ToggleOption[];
    current: string;
    /** Runtime type of the query field. Defaults to `'string'`. Set to
     * `'number'` for plain numeric fields and `'numberOrNull'` when the
     * field also accepts `null` as a sentinel (e.g. `windowDays = null`
     * meaning "all-time"). The pill's string value `'null'` parses to
     * literal `null`; everything else parses via `Number()`. */
    valueType?: ToggleValueType;
}

export interface ToggleOption {
    value: string;
    label: string;
}

/** Mixed into any directive type that supports replay + toggles.
 * Directives without `query` aren't replayable — controller becomes a
 * passthrough that just renders the snapshot. */
export interface ReplayableDirective<TQuery extends BaseQuery = BaseQuery> {
    query?: TQuery;
    toggles?: ToggleSpec<TQuery>[];
    /** Stable identity for client-side toggle persistence (localStorage).
     * Present → controller remembers user's selection across sessions.
     * Absent → toggle state is ephemeral. */
    persistKey?: string;
    /** Phase 4 Streams: canonical key derived from `query`. The server
     * computes this on every replayable directive emission so the client
     * can use it as the subscription handle without re-canonicalizing.
     * Absent on directives that aren't Stream-backed (e.g. one-shot
     * chat snapshots that don't go through recompose-registry). */
    streamKey?: string;
}

/** Server response from POST /api/architect/recompose. Generic over the
 * directive type the caller expects back. The endpoint dispatches by
 * `query.kind` so the response type is whatever that builder produces. */
export type RecomposeResponse<TDirective> = TDirective;
