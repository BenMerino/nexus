/* ── OutboxRelay (worker-side event delivery) ──────────────────
 * Runs in the WORKER process. Bridges the durable outbox → the worker's
 * in-process EventBus so lifecycle listeners fire cross-process.
 *
 * Mechanism (gold-standard for a pg-only stack): a dedicated pg.Client LISTENs
 * on the shared channel; each NOTIFY (and a fallback poll, in case a NOTIFY was
 * missed while disconnected) triggers a drain — claim unprocessed rows oldest-
 * first, re-emit each into the local bus with persistence OFF (so relayed events
 * don't loop back into the outbox), then mark them processed. At-least-once;
 * consumers (refresh/maintain) are idempotent, so re-delivery is safe.
 *
 * The web process never runs this — it only enqueues. Only the worker drains.
 * ──────────────────────────────────────────────────────────── */

import { eventBus } from "./EventBus";
const { Client } = require("pg");
const { CHANNEL, claimUnprocessed, markProcessed } = require("../lib/db-outbox");

const POLL_MS = 30_000; // fallback drain even if no NOTIFY arrives

class OutboxRelay {
  private client: any = null;
  private draining = false;
  private timer: NodeJS.Timeout | null = null;

  async start(): Promise<void> {
    const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    if (!url) { console.warn("[OutboxRelay] no DATABASE_URL — relay disabled"); return; }
    const isInternal = /\.railway\.internal(:|$|\/)/.test(url);
    this.client = new Client(isInternal ? { connectionString: url } : { connectionString: url, ssl: { rejectUnauthorized: false } });
    await this.client.connect();
    this.client.on("notification", () => this.drain());
    this.client.on("error", (e: Error) => console.error("[OutboxRelay] client error:", e.message));
    await this.client.query(`LISTEN ${CHANNEL}`);
    this.timer = setInterval(() => this.drain(), POLL_MS);
    this.timer.unref();
    console.log(`[OutboxRelay] LISTENing on ${CHANNEL} (poll ${POLL_MS}ms)`);
    await this.drain(); // catch up on anything enqueued while we were down
  }

  // Claim + dispatch the unprocessed tail. Re-entrant-safe via the draining flag.
  async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      for (;;) {
        const rows = await claimUnprocessed(100);
        if (!rows.length) break;
        eventBus.setPersist(false); // relayed events are local-only; don't re-outbox
        for (const r of rows) {
          try { eventBus.emit(r.channel, r.payload); }
          catch (e) { console.error(`[OutboxRelay] dispatch ${r.channel} failed:`, (e as Error).message); }
        }
        eventBus.setPersist(true);
        await markProcessed(rows.map((r: any) => r.id));
      }
    } catch (e) {
      console.error("[OutboxRelay] drain error:", (e as Error).message);
    } finally {
      this.draining = false;
    }
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    if (this.client) { try { await this.client.end(); } catch { /* shutting down */ } }
  }
}

export const outboxRelay = new OutboxRelay();
