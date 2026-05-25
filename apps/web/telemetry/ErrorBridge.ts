import type { AppId, BridgeOptions, ClientErrorPayload, Severity } from "./error.types";
import { resolveTenantId, getSessionId } from "./ErrorContext";

let installed = false;
let buffer: ClientErrorPayload[] = [];
let opts: Required<Omit<BridgeOptions, "resolveTenantId" | "resolveUserId">> & Pick<BridgeOptions, "resolveTenantId" | "resolveUserId"> = {
    app: "admin" as AppId,
    apiBase: "",
    flushIntervalMs: 5000,
    bufferMax: 50,
};

function push(p: ClientErrorPayload): void {
    if (buffer.length >= opts.bufferMax) buffer.shift();
    buffer.push(p);
}

function makePayload(severity: Severity, message: string, stack: string | undefined): ClientErrorPayload {
    return {
        app: opts.app,
        severity,
        message: message.slice(0, 2000),
        stack: stack?.slice(0, 16000),
        url: typeof window !== "undefined" ? window.location.href : undefined,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
        userId: opts.resolveUserId?.(),
        sessionId: getSessionId(),
    };
}

export function captureError(message: string, stack?: string, severity: Severity = "error", metadata?: unknown): void {
    const p = makePayload(severity, message, stack);
    if (metadata !== undefined) p.metadata = metadata;
    push(p);
}

export function flushNow(useBeacon = true): void {
    if (buffer.length === 0) return;
    const tenantId = opts.resolveTenantId?.() ?? resolveTenantId();
    const url = `${opts.apiBase}/api/telemetry/frontend`;
    const body = JSON.stringify({ tenantId, errors: buffer });
    buffer = [];
    if (useBeacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon(url, blob);
    } else if (typeof fetch !== "undefined") {
        fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
    }
}

export function installErrorBridge(options: BridgeOptions): void {
    if (installed || typeof window === "undefined") return;
    installed = true;
    opts = { ...opts, ...options };

    window.addEventListener("error", (ev) => {
        captureError(ev.message ?? "Unknown error", ev.error?.stack, "error");
    });
    window.addEventListener("unhandledrejection", (ev) => {
        const reason = (ev as PromiseRejectionEvent).reason;
        const message = reason instanceof Error ? reason.message : String(reason);
        const stack = reason instanceof Error ? reason.stack : undefined;
        captureError(message, stack, "unhandled-rejection");
    });
    window.addEventListener("beforeunload", () => flushNow(true));
    setInterval(() => flushNow(true), opts.flushIntervalMs);
}
