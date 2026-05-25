/**
 * `useUserUiPref` — per-(tenant, user) preference, persisted server-side.
 *
 * Reads once on mount, writes on change (debounced). Returns the
 * defaultValue until the GET resolves so callers don't flash an
 * empty state. Failures fall back to the default — never crash a
 * dashboard because a preference fetch 500'd.
 *
 * scope_key convention: '<surface>:<id>:<facet>' (e.g.
 * 'chart:orders.revenueTrend:features'). The substrate is uniform;
 * the namespace is by convention, documented at the call site.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { apiGet, apiPut } from '../telemetry/apiClient.js';

interface PrefResponse<T> { scopeKey: string; value: T; updatedAt: string }

const WRITE_DEBOUNCE_MS = 400;

export type PrefStatus = 'loading' | 'ready' | 'error';

export function useUserUiPref<T>(
    scopeKey: string,
    defaultValue: T,
): [T, (next: T) => void, PrefStatus] {
    const [value, setValue] = useState<T>(defaultValue);
    const [status, setStatus] = useState<PrefStatus>('loading');
    const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    /* Stable defaultValue ref — callers often pass an inline literal
     *  ({}, []), which would otherwise retrigger the load effect on
     *  every render and clobber the just-set state. */
    const defaultRef = useRef(defaultValue);

    useEffect(() => {
        let cancelled = false;
        setStatus('loading');
        apiGet<PrefResponse<T> | null>(`/api/user-ui-prefs/${encodeURIComponent(scopeKey)}`)
            .then(res => {
                if (cancelled) return;
                /* 204 → apiGet returns null body. Use the default and stay 'ready'. */
                setValue(res && typeof res === 'object' && 'value' in res ? res.value : defaultRef.current);
                setStatus('ready');
            })
            .catch(() => {
                if (cancelled) return;
                /* Errors degrade to default, not crash. Status reflects the
                 *  truth so callers can distinguish "loaded from server" from
                 *  "couldn't reach server, using fallback." */
                setValue(defaultRef.current);
                setStatus('error');
            });
        return () => { cancelled = true; };
    }, [scopeKey]);

    const update = useCallback((next: T) => {
        setValue(next);
        if (writeTimer.current) clearTimeout(writeTimer.current);
        writeTimer.current = setTimeout(() => {
            apiPut(`/api/user-ui-prefs/${encodeURIComponent(scopeKey)}`, { value: next })
                .catch(() => {
                    /* Write failures are non-fatal — local state already
                     *  reflects the user's choice; next mount will reconcile
                     *  with whatever the server has. */
                });
        }, WRITE_DEBOUNCE_MS);
    }, [scopeKey]);

    useEffect(() => () => {
        if (writeTimer.current) clearTimeout(writeTimer.current);
    }, []);

    return [value, update, status];
}
