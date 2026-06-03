/* ── StreamInvalidationListener (web-side, read-only observer) ──
 * Runs in the WEB/API process — where the chart WS clients live. The durable
 * event backbone (outbox + NOTIFY nexus_events) is drained for CONSUMPTION by
 * the worker's OutboxRelay. This is NOT a consumer: it's a passive observer
 * that LISTENs the same channel and, on each NOTIFY, PEEKS the row (read-only,
 * never claims/marks) to learn which tenant changed, then re-pushes that
 * tenant's live charts via the StreamRegistry.
 *
 * Why this exists: ingestion/refresh now run in the WORKER process, so
 * `publication.upserted` / `ingestion.completed` fire on the worker's in-process
 * bus — the API process's `eventBus.on` never hears them. WS clients are here.
 * Without this LISTEN, live chart invalidation would silently never fire for
 * background ingestion (the case it's for). Peeking (no claim/mark) means we
 * coexist with the worker's at-least-once drain without racing it.
 *
 * Best-effort by design: a missed NOTIFY just leaves a chart briefly stale
 * until the next interaction — acceptable for cache invalidation (unlike the
 * worker's lifecycle consumers, which need durability).
 * ──────────────────────────────────────────────────────────── */

import { streamRegistry } from "./StreamRegistry";
import { directiveCache } from "./DirectiveCache";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Client } = require("pg");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { CHANNEL, peekEvent } = require("../../lib/db-outbox");

/** Channels whose payloads change publication-derived charts. Kept in sync with
 *  stream-ws's in-process set — both drive the same `invalidateTenant`. */
const INVALIDATING = new Set(["publication.upserted", "ingestion.completed"]);

class StreamInvalidationListener {
  private client: any = null;

  async start(): Promise<void> {
    const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    if (!url) { console.warn("[StreamInvalidation] no DATABASE_URL — listener disabled"); return; }
    const isInternal = /\.railway\.internal(:|$|\/)/.test(url);
    this.client = new Client(isInternal ? { connectionString: url } : { connectionString: url, ssl: { rejectUnauthorized: false } });
    await this.client.connect();
    this.client.on("notification", (msg: { payload?: string }) => { void this.onNotify(msg?.payload); });
    this.client.on("error", (e: Error) => console.error("[StreamInvalidation] client error:", e.message));
    await this.client.query(`LISTEN ${CHANNEL}`);
    console.log(`[StreamInvalidation] LISTENing on ${CHANNEL}`);
  }

  // NOTIFY payload is the outbox row id (see db-outbox.enqueueEvent). Peek it
  // read-only; invalidate the tenant when the channel is chart-affecting.
  private async onNotify(payload: string | undefined): Promise<void> {
    if (!payload) return;
    try {
      const row = await peekEvent(payload);
      if (!row || !INVALIDATING.has(row.channel)) return;
      // Bust the HTTP directive cache (whole tenant — the NOTIFY carries no
      // kind) AND re-push live WS streams.
      directiveCache.invalidateTenant(Number(row.tenant_id));
      await streamRegistry.invalidateTenant(Number(row.tenant_id));
    } catch (e) {
      console.warn("[StreamInvalidation] peek/invalidate failed:", (e as Error).message);
    }
  }

  async stop(): Promise<void> {
    if (this.client) { try { await this.client.end(); } catch { /* shutting down */ } }
  }
}

export const streamInvalidationListener = new StreamInvalidationListener();
