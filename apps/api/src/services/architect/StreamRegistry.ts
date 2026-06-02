/* ── StreamRegistry (server Streams) ────────────────────────
 * The server half of the directive-stream bridge. Holds live WS
 * subscriptions keyed by streamKey, serves a `directive.value` on
 * subscribe, and re-pushes a fresh value when a Governor event
 * invalidates an affected stream.
 *
 * SCOPE: only PUBLIC kinds stream here (the anonymous tenant charts).
 * Scoped kinds would need authenticated WS sessions — out of scope; the
 * registry refuses them, mirroring the HTTP recompose firewall (§B).
 *
 * INVALIDATION MODEL: public directives carry atoms (empty `data`), so the
 * client's address-keyed `applyStreamPatch` (a `data`-row merge) doesn't
 * apply — atom charts re-push a full `directive.value` (the atom array is
 * small). The `directive.patch` frame is reserved for future `data`-row
 * kinds. On invalidation we recompute and send the full value; the client
 * replaces state identically.
 *
 * LIMITATION: the EventBus is in-process/single-instance. A Governor event
 * on another API instance won't reach sockets here. Documented; matches the
 * bus's own contract. Revisit if the API scales horizontally.
 * ──────────────────────────────────────────────────────────── */

import type { WebSocket } from "ws";
import { recomposePublic, accessOf, type PublicQuery } from "./recompose-registry";
import { streamKeyOf } from "./stream-key-server";

interface Subscription {
  socket: WebSocket;
  query: PublicQuery;
}

class StreamRegistry {
  /** streamKey → live subscriptions. Many sockets may share one key. */
  private byKey = new Map<string, Set<Subscription>>();
  /** reverse index so a closing socket cleans up all its keys cheaply. */
  private bySocket = new Map<WebSocket, Set<string>>();

  /** Handle a `stream.subscribe`. Refuses non-public kinds. Computes the
   *  directive and pushes a `directive.value`. */
  async subscribe(socket: WebSocket, query: PublicQuery): Promise<void> {
    if (accessOf(query.kind) !== "public") {
      this.sendError(socket, streamKeyOf(query), "kind is not publicly streamable");
      return;
    }
    const key = streamKeyOf(query);
    let subs = this.byKey.get(key);
    if (!subs) { subs = new Set(); this.byKey.set(key, subs); }
    const sub: Subscription = { socket, query };
    subs.add(sub);
    let keys = this.bySocket.get(socket);
    if (!keys) { keys = new Set(); this.bySocket.set(socket, keys); }
    keys.add(key);
    await this.pushValue(socket, key, query);
  }

  /** Handle a `stream.unsubscribe` for one key on one socket. */
  unsubscribe(socket: WebSocket, key: string): void {
    const subs = this.byKey.get(key);
    if (subs) {
      for (const s of subs) if (s.socket === socket) subs.delete(s);
      if (subs.size === 0) this.byKey.delete(key);
    }
    this.bySocket.get(socket)?.delete(key);
  }

  /** Drop every subscription for a socket (on close). */
  dropSocket(socket: WebSocket): void {
    const keys = this.bySocket.get(socket);
    if (!keys) return;
    for (const key of keys) {
      const subs = this.byKey.get(key);
      if (!subs) continue;
      for (const s of subs) if (s.socket === socket) subs.delete(s);
      if (subs.size === 0) this.byKey.delete(key);
    }
    this.bySocket.delete(socket);
  }

  /** A Governor event touched `tenantId` — re-push every subscribed stream
   *  for that tenant. Recompute is per-key (queries differ by window/asOf). */
  async invalidateTenant(tenantId: number): Promise<void> {
    const tid = String(tenantId);
    for (const [key, subs] of this.byKey) {
      // All subs under one key share the same query.
      const first = subs.values().next().value as Subscription | undefined;
      if (!first || first.query.tenantId !== tid) continue;
      for (const sub of subs) await this.pushValue(sub.socket, key, sub.query);
    }
  }

  private async pushValue(socket: WebSocket, key: string, query: PublicQuery): Promise<void> {
    try {
      const value = await recomposePublic(query);
      this.send(socket, { type: "directive.value", payload: { streamKey: key, value } });
    } catch (e) {
      this.sendError(socket, key, e instanceof Error ? e.message : "recompose failed");
    }
  }

  private sendError(socket: WebSocket, streamKey: string, error: string): void {
    this.send(socket, { type: "directive.error", payload: { streamKey, error } });
  }

  private send(socket: WebSocket, frame: unknown): void {
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(frame));
  }
}

export const streamRegistry = new StreamRegistry();
