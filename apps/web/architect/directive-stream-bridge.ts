/* ── Directive Stream Bridge ────────────────────────────────
 * Shared singleton that lets `useDirectiveController` (in shared)
 * subscribe to Streams without importing app-specific WS code.
 *
 * Each app's `WebSocketConnector` calls `setStreamBridge(...)`
 * once at boot to plug in:
 *   - `send`: ship a frame over the active WebSocket
 *   - `onMessage`: subscribe to incoming frames (filter by type)
 *
 * Apps that don't set a bridge fall through gracefully: the
 * controller uses the recompose endpoint and never tries to
 * subscribe. No-op is the right default for non-React tooling
 * (verify probes, server-side renders).
 *
 * Phase 5 added directive.patch frames; the bridge contract is
 * unchanged (still { type, payload }) — listeners filter by frame
 * type. The set of types may grow further; centralize if needed.
 * ──────────────────────────────────────────────────────────── */

/** Minimal patch shape — must match server-side StreamPatch (apps/api
 * StreamRegistryService.ts). Kept in shared so the merge function
 * lives next to the consumer. */
export interface StreamPatch {
    removed?: string[];
    upserted?: Array<{ address: string; row: unknown }>;
    meta?: Record<string, unknown>;
}

/** Wire shape mirrors the existing WS `{ type, payload }` convention so
 * apps can dispatch frames through their existing realtime bus without
 * special-casing. */
export type StreamFrame =
    | { type: 'directive.value'; payload: { streamKey: string; value: unknown } }
    | { type: 'directive.patch'; payload: { streamKey: string; patch: StreamPatch } }
    | { type: 'directive.error'; payload: { streamKey: string; error: string } };

export interface StreamBridge {
    /** Whether the underlying WS is currently open. Hooks read this
     * to decide subscribe vs. fallback. */
    isConnected(): boolean;
    /** Send a `stream.subscribe` or `stream.unsubscribe` frame. */
    send(message: { type: 'stream.subscribe'; query: { kind: string; tenantId: string; [k: string]: unknown } } | { type: 'stream.unsubscribe'; streamKey: string }): void;
    /** Subscribe to incoming frames. Returns an unsubscribe function.
     * The bridge filters frames so the listener only sees
     * `directive.value` / `directive.error`. */
    onMessage(listener: (frame: StreamFrame) => void): () => void;
}

let bridge: StreamBridge | null = null;

/** Apps call this once at boot from their `WebSocketConnector`.
 * Passing `null` clears the bridge (test cleanup). */
export function setStreamBridge(b: StreamBridge | null): void {
    bridge = b;
}

/** Hooks read the active bridge. May return null if no app has
 * registered one — caller must handle that path (typically by
 * falling back to the recompose endpoint). */
export function getStreamBridge(): StreamBridge | null {
    return bridge;
}
