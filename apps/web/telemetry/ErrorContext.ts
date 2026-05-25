// Resolves tenantId for an error capture without taking a hard dependency on
// any single app's auth model. Order: explicit override → URL path segment →
// JWT (if present in localStorage under any common key) → '_unauth'.

// Tri-token auth pattern: each authed app stores its JWT under its own key.
// Order: most specific first. Consumer and landing don't auth — they fall
// through to '_unauth' via the resolveTenantId chain.
const JWT_KEYS = ["zincro_admin_token", "zincro_sa_token", "zincro_provider_token"];

function decodeJwtTenantId(token: string): string | undefined {
    try {
        const [, payload] = token.split(".");
        if (!payload) return;
        const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
        return typeof json.tenantId === "string" ? json.tenantId : undefined;
    } catch { return; }
}

function tenantFromUrl(): string | undefined {
    if (typeof window === "undefined") return;
    const m = window.location.pathname.match(/^\/(tenant|t)\/([^/]+)/);
    return m?.[2];
}

function tenantFromStorage(): string | undefined {
    if (typeof localStorage === "undefined") return;
    for (const k of JWT_KEYS) {
        const t = localStorage.getItem(k);
        if (t) {
            const tid = decodeJwtTenantId(t);
            if (tid) return tid;
        }
    }
    return;
}

export function resolveTenantId(): string {
    return tenantFromUrl() ?? tenantFromStorage() ?? "_unauth";
}

let cachedSession: string | undefined;
export function getSessionId(): string {
    if (cachedSession) return cachedSession;
    cachedSession = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    return cachedSession;
}
