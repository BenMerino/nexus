/* ── Stream WS endpoint ─────────────────────────────────────
 * Attaches a WebSocket server at `/api/stream` to the existing HTTP
 * server (so Caddy's `/api/*` reverse_proxy routes it in prod) and bridges
 * frames to the StreamRegistry. Also subscribes the registry to the
 * Governor EventBus so writes invalidate live charts.
 *
 * Frame protocol (matches the client StreamBridge contract):
 *   in:  { type: 'stream.subscribe',   query }
 *        { type: 'stream.unsubscribe', streamKey }
 *   out: { type: 'directive.value' | 'directive.patch' | 'directive.error', payload }
 *
 * Wired once at boot from index.js after app.listen.
 * ──────────────────────────────────────────────────────────── */

import type { Server as HttpServer } from "http";
import { WebSocketServer, type WebSocket } from "ws";
import { streamRegistry } from "./StreamRegistry";
import { streamInvalidationListener } from "./StreamInvalidationListener";
import { eventBus } from "../EventBus";

/** Governor events that change publication-derived charts. Each carries a
 *  tenantId; an event re-pushes every live stream for that tenant. The
 *  in-process `eventBus.on` below only catches events emitted IN THIS process;
 *  ingestion runs in the WORKER, so the real cross-process path is the
 *  StreamInvalidationListener (outbox NOTIFY). This set is the same on both. */
const INVALIDATING_EVENTS = ["publication.upserted", "ingestion.completed"] as const;

export function attachStreamWs(server: HttpServer): void {
  const wss = new WebSocketServer({ server, path: "/api/stream" });

  wss.on("connection", (socket: WebSocket) => {
    socket.on("message", (raw) => {
      let frame: { type?: string; query?: unknown; streamKey?: string };
      try { frame = JSON.parse(String(raw)); } catch { return; }
      if (frame.type === "stream.subscribe" && frame.query) {
        void streamRegistry.subscribe(socket, frame.query as never);
      } else if (frame.type === "stream.unsubscribe" && frame.streamKey) {
        streamRegistry.unsubscribe(socket, frame.streamKey);
      }
    });
    socket.on("close", () => streamRegistry.dropSocket(socket));
    socket.on("error", () => streamRegistry.dropSocket(socket));
  });

  // Same-process belt-and-suspenders: if an invalidating event is ever emitted
  // in THIS process, invalidate immediately (no DB round-trip).
  for (const ev of INVALIDATING_EVENTS) {
    eventBus.on(ev, (payload: { tenantId: number }) => {
      void streamRegistry.invalidateTenant(payload.tenantId);
    });
  }

  // Real cross-process path: ingestion runs in the worker, so listen on the
  // outbox NOTIFY backbone for events the worker emits. Best-effort observer.
  void streamInvalidationListener.start();

  console.log("[boot] Stream WS attached at /api/stream");
}
