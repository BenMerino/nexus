import type { BaseQuery } from './replayable-directive.js';

/* ── Stream Key ─────────────────────────────────────────────
 * Canonical serialization of a replayable query into a stable
 * string identity. Two queries serialize to the same StreamKey
 * iff they describe the same Stream — same kind, same scope,
 * same parameters in any order.
 *
 * The server uses StreamKey to dedupe Streams: two clients
 * subscribing to the same query share one cached value. The
 * client uses StreamKey to identify which patches belong to
 * which subscription.
 *
 * Pure function. Symmetric across server and client. Phase 4
 * Streams substrate keys off this. tested in __tests__/.
 * ──────────────────────────────────────────────────────────── */

export type StreamKey = string;

/** Canonicalize a query into a stable string key. Sorts fields
 * alphabetically so `{ kind, tenantId, range }` and
 * `{ range, tenantId, kind }` produce the same key. Skips
 * `undefined` values so `{ range: undefined }` matches absence.
 *
 * The output is a JSON string with sorted keys — readable and
 * naturally collision-resistant. We don't hash to keep
 * server-side debugging simple (Stream keys appear verbatim in
 * logs and admin tools). */
export function streamKeyFromQuery(query: BaseQuery): StreamKey {
    const obj = query as unknown as Record<string, unknown>;
    const keys = Object.keys(obj).filter(k => obj[k] !== undefined).sort();
    const sorted: Record<string, unknown> = {};
    for (const k of keys) sorted[k] = obj[k];
    return JSON.stringify(sorted);
}

/** Inverse — parse a key back to its query. Used by the server
 * when a stream invalidates and we need to reconstruct the query
 * to call the builder. */
export function queryFromStreamKey(key: StreamKey): BaseQuery {
    return JSON.parse(key) as BaseQuery;
}
