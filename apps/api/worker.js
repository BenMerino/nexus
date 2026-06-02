// Lifecycle worker process (Railway service: node dist/worker.js).
//
// Process-isolated from the web API. Owns the tenant-data lifecycle: it LISTENs
// for governor events (via the OutboxRelay, draining the durable outbox the web
// process fills) and runs scheduled per-tenant upkeep (refresh + maintenance).
//
// It does NOT run migrations (the web process owns schema on boot — running them
// from two processes races). It DOES bootstrap the DGA (governors/scanners) so
// the event listeners and workflows resolve, then starts the relay + scheduler.

const { pool } = require("./src/lib/sql");

async function startWorker() {
  if (!(process.env.POSTGRES_URL || process.env.DATABASE_URL)) {
    console.error("[worker] no DATABASE_URL — worker cannot run");
    process.exit(1);
  }
  // Bootstrap governors/scanners (audit ledger + action/resolver registries).
  try {
    require("./src/services/bootstrap").bootstrap();
  } catch (err) {
    console.error("[worker] DGA bootstrap failed:", err.message);
    process.exit(1);
  }

  const { outboxRelay } = require("./src/services/OutboxRelay");
  const { registerLifecycleListeners } = require("./src/services/lifecycle/lifecycle-listeners");
  const { lifecycleScheduler } = require("./src/services/lifecycle/LifecycleScheduler");

  // Order: listeners first (so a relayed event right after start has a handler),
  // then the relay (begins draining), then the scheduler (periodic + first run).
  registerLifecycleListeners();
  await outboxRelay.start();
  lifecycleScheduler.start();
  console.log("[worker] lifecycle worker up (relay + scheduler)");

  attachShutdown(outboxRelay, lifecycleScheduler);
}

function attachShutdown(relay, scheduler) {
  let shuttingDown = false;
  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[worker] received ${signal}, draining…`);
    try { scheduler.stop(); } catch {}
    try { await relay.stop(); } catch {}
    try { if (pool) await pool.end(); } catch {}
    console.log("[worker] done");
    process.exit(0);
  }
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

startWorker().catch((err) => {
  console.error("[worker] fatal:", err);
  process.exit(1);
});
