import { setStreamBridge, type StreamBridge, type StreamFrame } from './directive-stream-bridge.js';

/* ── WebSocketConnector ─────────────────────────────────────
 * The Nexus app's concrete StreamBridge: a WebSocket to `/api/stream`
 * (routed by Caddy's /api/* reverse_proxy in prod). Registers itself via
 * `setStreamBridge` at boot; once connected, `useDirectiveController`
 * subscribes through it and charts go live (isLive=true). When the socket
 * is down, `isConnected()` returns false and controllers fall back to HTTP
 * recompose — the page never breaks.
 *
 * Reconnect: exponential-ish backoff capped at 10s. Queued subscribe frames
 * sent before the socket opens are flushed on open. Idempotent boot: a second
 * connect() call is a no-op while a socket exists.
 * ──────────────────────────────────────────────────────────── */

type OutFrame =
    | { type: 'stream.subscribe'; query: { kind: string; tenantId: string; [k: string]: unknown } }
    | { type: 'stream.unsubscribe'; streamKey: string };

class WebSocketConnector implements StreamBridge {
    private ws: WebSocket | null = null;
    private listeners = new Set<(frame: StreamFrame) => void>();
    private outbox: OutFrame[] = [];
    private backoff = 500;
    private closedByUs = false;

    connect(): void {
        if (this.ws || typeof window === 'undefined') return;
        const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const url = `${proto}://${window.location.host}/api/stream`;
        let sock: WebSocket;
        try { sock = new WebSocket(url); } catch { this.scheduleReconnect(); return; }
        this.ws = sock;
        sock.onopen = () => {
            this.backoff = 500;
            for (const f of this.outbox.splice(0)) sock.send(JSON.stringify(f));
        };
        sock.onmessage = (ev) => {
            let frame: StreamFrame;
            try { frame = JSON.parse(ev.data); } catch { return; }
            if (frame.type === 'directive.value' || frame.type === 'directive.patch' || frame.type === 'directive.error') {
                for (const l of this.listeners) l(frame);
            }
        };
        sock.onclose = () => { this.ws = null; if (!this.closedByUs) this.scheduleReconnect(); };
        sock.onerror = () => { try { sock.close(); } catch { /* already closing */ } };
    }

    private scheduleReconnect(): void {
        const delay = this.backoff;
        this.backoff = Math.min(this.backoff * 2, 10_000);
        setTimeout(() => this.connect(), delay);
    }

    isConnected(): boolean {
        return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
    }

    send(message: OutFrame): void {
        if (this.isConnected()) this.ws!.send(JSON.stringify(message));
        else this.outbox.push(message); // flushed on (re)open
    }

    onMessage(listener: (frame: StreamFrame) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
}

/** Boot the bridge once. Safe to call from every page's entry — the
 *  connector is a singleton and connect() is idempotent. */
let connector: WebSocketConnector | null = null;
export function bootStreamBridge(): void {
    if (connector) return;
    connector = new WebSocketConnector();
    setStreamBridge(connector);
    connector.connect();
}
