import { captureError } from "./ErrorBridge";
import { getAuthHeaders } from "../hooks/auth-headers.js";

export interface ApiClientOptions {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    headers?: Record<string, string>;
    body?: any;
    /** Free-form context for telemetry (entity type, intent, etc). */
    context?: Record<string, unknown>;
    /** Treat these statuses as success (e.g. 404 for an optional read). Default: 2xx only. */
    okStatuses?: number[];
    signal?: AbortSignal;
    /** Set false for routes that MUST go anonymous (consumer-public, login bootstrap). Default true. */
    auth?: boolean;
}

export class ApiError extends Error {
    status: number;
    body: any;
    constructor(status: number, body: any, message: string) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.body = body;
    }
}

function isOk(status: number, okStatuses?: number[]): boolean {
    if (okStatuses?.includes(status)) return true;
    return status >= 200 && status < 300;
}

function severityFor(status: number, isWrite: boolean): "warn" | "error" {
    // 4xx on writes = user/client problem worth seeing; 5xx = server problem; reads default to warn for 4xx since 404s are routine.
    if (status >= 500) return "error";
    if (isWrite) return "error";
    return "warn";
}

function summarize(body: any): string {
    if (!body) return "";
    if (typeof body === "string") return body.slice(0, 500);
    if (typeof body === "object") {
        const reason = body.reason ?? body.message ?? body.detail;
        if (typeof reason === "string") return reason.slice(0, 500);
        try { return JSON.stringify(body).slice(0, 500); } catch { return String(body).slice(0, 500); }
    }
    return String(body).slice(0, 500);
}

/**
 * Single shared client for any API call from a Zincro frontend (admin, consumer, provider, landing, super-admin).
 * On non-2xx or network failure, captures structured telemetry via the existing ErrorBridge AND rethrows.
 * Callers handle UX; telemetry happens automatically.
 */
export async function apiCall<T = any>(url: string, options: ApiClientOptions = {}): Promise<T> {
    const method = options.method ?? "GET";
    const isWrite = method !== "GET";
    /* Default: attach Authorization from whichever app-token key is in
     * localStorage (admin/provider/super-admin). Opt out with auth:false
     * for consumer-public routes and pre-login bootstrap calls. Caller-
     * supplied headers win — explicit always beats default. */
    const authHeaders = options.auth === false ? {} : getAuthHeaders();
    const init: RequestInit = {
        method,
        headers: { "Content-Type": "application/json", ...authHeaders, ...(options.headers ?? {}) },
        signal: options.signal,
    };
    if (options.body !== undefined && method !== "GET") init.body = typeof options.body === "string" ? options.body : JSON.stringify(options.body);

    let res: Response;
    try {
        res = await fetch(url, init);
    } catch (err: any) {
        // AbortError is an intentional cancellation (caller passed an
        // AbortSignal that was triggered — StrictMode double-mount,
        // controller query change, route unmount). Not a failure; don't
        // report it. The caller's own catch handler decides what to do
        // (typically: nothing). Pre-fix this emitted thousands of false
        // "Network error" entries per session — see decision memory
        // `gotcha_apiclient_abort_telemetry`.
        const isAbort = err?.name === "AbortError" || init.signal?.aborted;
        if (!isAbort) {
            captureError(`Network error ${method} ${url}: ${err?.message ?? String(err)}`, err?.stack, "error", {
                kind: "network", method, url, ...options.context,
            });
        }
        throw err;
    }

    let body: any = null;
    const contentType = res.headers.get("content-type") ?? "";
    try {
        if (contentType.includes("application/json")) body = await res.json();
        else { const text = await res.text(); body = text || null; }
    } catch { body = null; }

    if (!isOk(res.status, options.okStatuses)) {
        const reason = summarize(body);
        captureError(
            `${method} ${url} → ${res.status}${reason ? `: ${reason}` : ""}`,
            undefined,
            severityFor(res.status, isWrite),
            { kind: "http", method, url, status: res.status, body, ...options.context },
        );
        throw new ApiError(res.status, body, reason || `HTTP ${res.status}`);
    }

    return body as T;
}

export const apiGet = <T = any>(url: string, options: Omit<ApiClientOptions, "method" | "body"> = {}) =>
    apiCall<T>(url, { ...options, method: "GET" });

export const apiPost = <T = any>(url: string, body?: any, options: Omit<ApiClientOptions, "method"> = {}) =>
    apiCall<T>(url, { ...options, method: "POST", body });

export const apiPut = <T = any>(url: string, body?: any, options: Omit<ApiClientOptions, "method"> = {}) =>
    apiCall<T>(url, { ...options, method: "PUT", body });

export const apiPatch = <T = any>(url: string, body?: any, options: Omit<ApiClientOptions, "method"> = {}) =>
    apiCall<T>(url, { ...options, method: "PATCH", body });

export const apiDelete = <T = any>(url: string, options: Omit<ApiClientOptions, "method" | "body"> = {}) =>
    apiCall<T>(url, { ...options, method: "DELETE" });
