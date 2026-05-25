export const VALID_APPS = ["admin", "super-admin", "consumer", "provider", "landing", "api"] as const;
export type AppId = typeof VALID_APPS[number];

export const VALID_SEVERITIES = ["error", "warn", "unhandled-rejection", "react-boundary"] as const;
export type Severity = typeof VALID_SEVERITIES[number];

export interface ClientErrorPayload {
    app: AppId;
    severity: Severity;
    message: string;
    stack?: string;
    url?: string;
    userAgent?: string;
    userId?: string;
    sessionId?: string;
    metadata?: unknown;
}

export interface BridgeOptions {
    app: AppId;
    apiBase?: string;
    flushIntervalMs?: number;
    bufferMax?: number;
    resolveTenantId?: () => string | undefined;
    resolveUserId?: () => string | undefined;
}
