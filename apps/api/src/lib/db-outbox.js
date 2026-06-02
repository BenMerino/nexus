// Transactional outbox data layer (N4 — SQL lives here). The durable backbone
// for cross-process events: a governor enqueues an event row (ideally in the
// SAME transaction as its data write, by passing that tx client), then a
// NOTIFY wakes the worker's OutboxRelay, which claims + marks rows processed.
// The row is the source of truth; NOTIFY is only latency. At-least-once.

const { sql, pool } = require("./sql");

const CHANNEL = "nexus_events"; // the Postgres NOTIFY channel both processes share

// Enqueue an event + fire NOTIFY. `client` (optional) is a pg client from an
// open governor transaction — pass it so the outbox row commits atomically with
// the data write. Without it, the row is written best-effort on the pool.
async function enqueueEvent(client, tenantId, channel, payload) {
  const runner = client || pool;
  if (!runner) return; // no DB configured (import-only contexts)
  const r = await runner.query(
    `INSERT INTO event_outbox (tenant_id, channel, payload)
     VALUES ($1, $2, $3) RETURNING id`,
    [tenantId, channel, JSON.stringify(payload)],
  );
  // pg_notify lets us parameterize the payload (the LISTEN/NOTIFY statement form
  // cannot). Fire on the same runner so it rides the tx (notify is delivered on
  // commit when inside a tx — exactly what we want).
  await runner.query(`SELECT pg_notify($1, $2)`, [CHANNEL, String(r.rows[0].id)]);
  return r.rows[0].id;
}

// Claim the unprocessed tail in id order. SKIP LOCKED keeps it safe if more than
// one relay ever runs (today only the worker does). Returns rows oldest-first.
async function claimUnprocessed(limit = 100) {
  const r = await sql.query(
    `SELECT id, tenant_id, channel, payload FROM event_outbox
       WHERE processed_at IS NULL
       ORDER BY id
       LIMIT $1
       FOR UPDATE SKIP LOCKED`,
    [limit],
  );
  return r.rows;
}

async function markProcessed(ids) {
  if (!ids.length) return;
  await sql.query(
    `UPDATE event_outbox SET processed_at = now() WHERE id = ANY($1::bigint[])`,
    [ids],
  );
}

module.exports = { CHANNEL, enqueueEvent, claimUnprocessed, markProcessed };
