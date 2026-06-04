/**
 * The graph-engine's ONE app-coupling boundary.
 *
 * The engine is otherwise self-contained (its own primitives, composed
 * components, architect types, visual-lang). The only things it can't
 * own are app-specific: how to fetch from the host's API, how the host
 * exposes dark mode, and how the host persists per-user UI prefs. Those
 * three are injected here as a single `EngineConfig` so the engine
 * source is identical across consumers (Zincro app, nexus app, a future
 * published `@zincro/graph-engine`) — no forked files, no carbon copy.
 *
 * Resolution: `useEngineConfig()` reads a React context. A host mounts
 * `<GraphEngineProvider value={...}>` once at its root to wire real
 * implementations. The DEFAULTS are deliberately app-agnostic (no import
 * of telemetry/hooks), so an engine rendered without a provider still
 * behaves sanely — theme reads the DOM directly, data/pref accessors are
 * inert rather than crashing. This is what lets the package stand alone.
 */

import React from 'react';

/** Minimal fetch contract the engine needs (timeline span lookup). Mirrors
 *  the shape of the host's `apiGet` — a GET returning parsed JSON. */
export type EngineApiGet = <T = unknown>(
    url: string,
    options?: { context?: Record<string, unknown> },
) => Promise<T>;

export type EnginePrefStatus = 'loading' | 'ready' | 'error';

/** Per-(tenant,user) preference accessor — same contract as the host's
 *  `useUserUiPref`. Returns [value, setter, status]. */
export type EngineUseUiPref = <T>(
    scopeKey: string,
    defaultValue: T,
) => [T, (next: T) => void, EnginePrefStatus];

export interface EngineConfig {
    /** Host API GET — used by `useTimelineSpan` for the slider track. */
    apiGet: EngineApiGet;
    /** Host dark-mode signal — drives GPU re-tessellation on theme flip. */
    useIsDark: () => boolean;
    /** Host per-user UI preference store — drives persisted feature toggles. */
    useUiPref: EngineUseUiPref;
}

/** App-agnostic defaults. Crucially these import NOTHING from the host —
 *  that's what keeps the engine package free of app coupling.
 *   • useIsDark: read the `dark` class off <html> (the universal convention).
 *   • apiGet: reject — without a host API there's no timeline span (the
 *     slider just doesn't render; callers already .catch this).
 *   • useUiPref: in-memory only (prefs don't persist, but toggles still work). */
const defaultConfig: EngineConfig = {
    apiGet: () => Promise.reject(new Error('graph-engine: no apiGet configured (mount GraphEngineProvider)')),
    useIsDark: () => {
        const [isDark, setIsDark] = React.useState(
            () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
        );
        React.useEffect(() => {
            if (typeof document === 'undefined') return;
            const el = document.documentElement;
            const obs = new MutationObserver(() => setIsDark(el.classList.contains('dark')));
            obs.observe(el, { attributes: true, attributeFilter: ['class'] });
            return () => obs.disconnect();
        }, []);
        return isDark;
    },
    useUiPref: <T,>(_scopeKey: string, defaultValue: T) => {
        const [value, setValue] = React.useState<T>(defaultValue);
        return [value, setValue, 'ready'];
    },
};

const EngineConfigContext = React.createContext<EngineConfig>(defaultConfig);

export function GraphEngineProvider({
    value, children,
}: {
    value: EngineConfig;
    children: React.ReactNode;
}) {
    return <EngineConfigContext.Provider value={value}>{children}</EngineConfigContext.Provider>;
}

/** Read the active engine config. Falls back to the app-agnostic defaults
 *  when no provider is mounted. */
export function useEngineConfig(): EngineConfig {
    return React.useContext(EngineConfigContext);
}
