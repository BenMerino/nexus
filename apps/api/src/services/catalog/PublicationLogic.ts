/* ── PublicationLogic (pure) ───────────────────────────────────
 * Deterministic helpers for PublicationGovernor — no I/O, no events.
 * Mirrors exactly what store.js / store-openalex.js did inline before the
 * governor wrap, so the entity writes are byte-for-byte the same:
 *   - upsertRecord's positional arg list, built from a normalized record.
 *   - the canonicalized tag-shaped array syncRecordEntities consumes.
 * Behavior-neutral by construction — this is extraction, not change.
 * ──────────────────────────────────────────────────────────── */

import { extractTags, canonicalize } from "../../lib/normalize";

/** A normalized record (normalize.js / normalize-openalex.js output). */
export interface NormalizedRecord {
  doi: string;
  title?: string | null;
  authorNames?: unknown;
  published?: unknown;
  journal?: string | null;
  publisher?: string | null;
  type?: string | null;
  citationCount?: number | null;
  openAccess?: boolean | null;
  openAccessUrl?: string | null;
  abstract?: string | null;
  venue?: string | null;
  url?: string | null;
  authors?: unknown;
  issnL?: string | null;
  [k: string]: unknown;
}

/** The positional argument tuple for lib/db#upsertRecord, derived from a
 *  normalized record + its submission id and raw source payload. Matches the
 *  call previously made inline in store.js / store-openalex.js. */
export function upsertArgs(
  submissionId: number,
  record: NormalizedRecord,
  sources: unknown,
): unknown[] {
  return [
    submissionId, record.doi, record.title ?? null,
    record.authorNames ? JSON.stringify(record.authorNames) : null,
    record.published ?? null, record.journal ?? null, record.publisher ?? null, record.type ?? null,
    record.citationCount ?? null, record.openAccess || false, record.openAccessUrl ?? null,
    record.abstract ?? null, record.venue ?? null, record.url ?? null,
    record.authors ? JSON.stringify(record.authors) : null,
    JSON.stringify(sources),
  ];
}

/** Canonicalized tag-shaped array that syncRecordEntities derives entity
 *  writes from. The `tags` table is gone (P5) — this array is purely the
 *  intermediate shape for the entity sync, never persisted as tags. */
export function canonTags(record: NormalizedRecord): Array<Record<string, unknown>> {
  return extractTags(record).map((t: any) => ({ ...t, value: canonicalize(t.category, t.value) }));
}
