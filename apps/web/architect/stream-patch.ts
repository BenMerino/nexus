import type { StreamPatch } from './directive-stream-bridge.js';

/* ── Stream Patch Merge ─────────────────────────────────────
 * Pure helper that applies a server-emitted patch to a cached
 * directive value. Kinds choose what `address` means for their
 * row shape — for time-series the convention is `data[i].label`,
 * for entity-keyed shapes it's `data[i].id`. The merge function
 * here is generic: it works on any value that has a `.data: any[]`
 * with one of those address fields.
 *
 * If the value isn't shaped like { data: [] } (e.g. a single-value
 * gauge), the merge falls back to shallow-merging meta. The kind's
 * diff() should already have returned null in that case to force a
 * full-value push, but we handle it here defensively.
 *
 * Tested in __tests__/stream-patch.test.ts.
 * ──────────────────────────────────────────────────────────── */

interface AddressableRow {
    label?: string;
    id?: string;
    [k: string]: unknown;
}

interface DirectiveLike {
    data?: AddressableRow[];
    [k: string]: unknown;
}

/** Resolve a row's address — `label` first, then `id`. Mirrors what
 * the server-side diff() should emit: time-series builders address
 * by label, entity rows by id. */
function addressOf(row: AddressableRow): string | null {
    if (typeof row.label === 'string') return row.label;
    if (typeof row.id === 'string') return row.id;
    return null;
}

/** Apply a patch to a previous value. Returns a new object — never
 * mutates `prev`. Unknown shape (no .data array) falls back to meta-merge. */
export function applyStreamPatch<T extends DirectiveLike>(prev: T, patch: StreamPatch): T {
    const next: DirectiveLike = { ...prev };

    if (Array.isArray(prev.data)) {
        const removedSet = new Set(patch.removed ?? []);
        const upsertMap = new Map<string, unknown>();
        for (const u of patch.upserted ?? []) upsertMap.set(u.address, u.row);

        // 1) Drop removed rows. 2) Replace existing rows whose address is in
        //    upsertMap. 3) Append upserts whose address didn't already exist.
        const seen = new Set<string>();
        const updated: AddressableRow[] = [];
        for (const row of prev.data) {
            const addr = addressOf(row);
            if (addr === null) { updated.push(row); continue; }
            if (removedSet.has(addr)) continue;
            const replacement = upsertMap.get(addr);
            if (replacement !== undefined) {
                updated.push(replacement as AddressableRow);
                seen.add(addr);
            } else {
                updated.push(row);
            }
        }
        for (const [addr, row] of upsertMap) {
            if (!seen.has(addr) && !removedSet.has(addr)) updated.push(row as AddressableRow);
        }
        next.data = updated;
    }

    if (patch.meta) Object.assign(next, patch.meta);

    return next as T;
}
