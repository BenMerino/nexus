import { useCallback, useEffect, useRef, useState } from 'react';
import type { BaseQuery, ReplayableDirective } from './replayable-directive.js';
import { applyPersisted, sameQuery, applyToggleToQuery, nextPersisted, isAtomicVisibleWindowPatch } from './directive-controller-logic.js';
import type { ToggleValues } from './directive-controller-logic.js';
import { readPersisted, writePersisted } from './directive-toggle-persistence.js';
import { getStreamBridge } from './directive-stream-bridge.js';
import { useStreamWiring } from './directive-controller-stream.js';
import { recomposePost } from './recompose-client.js';
import type { DirectiveController } from './directive-controller.types.js';

export type { DirectiveController } from './directive-controller.types.js';

/* ── useDirectiveController ──────────────────────────────────
 * Owns directive state for a replayable directive. Once mounted, the
 * controller IGNORES the parent's `initial` prop: the parent owns the
 * *seed*, the controller owns the *current state*. To fully reset a
 * chart (tenant change), the page remounts via React `key`. This is the
 * invariant that kills the legend-toggle "reload" — a parent re-render
 * can never snap the directive (or its activeSet) back.
 *
 * Persistence: toggle selections mirror to localStorage by `persistKey`.
 * Streaming (isLive / directive.patch) is wired but dormant until an app
 * registers a StreamBridge (Phase C); HTTP recompose is the fallback.
 * Pure logic lives in `directive-controller-logic.ts`; bridge wiring in
 * `directive-controller-stream.ts`.
 * ──────────────────────────────────────────────────────────── */

export function useDirectiveController<TDirective extends ReplayableDirective<TQuery>, TQuery extends BaseQuery>(
    initial: TDirective,
): DirectiveController<TDirective, TQuery> {
    const persistedRef = useRef<ToggleValues>(readPersisted(initial.persistKey) ?? {});

    const initialQuery = initial.query;
    const effectiveInitialQuery = initialQuery
        ? applyPersisted<TQuery>(initialQuery, initial.toggles, persistedRef.current)
        : undefined;
    const needsInitialRefetch = !!effectiveInitialQuery && !!initialQuery && !sameQuery(initialQuery, effectiveInitialQuery);

    const [directive, setDirective] = useState<TDirective>(initial);
    const [isLoading, setIsLoading] = useState<boolean>(needsInitialRefetch);
    const [error, setError] = useState<string | null>(null);
    const [isLive, setIsLive] = useState<boolean>(false);
    const [breadcrumbs, setBreadcrumbs] = useState<Array<{ label: string; directive: TDirective }>>([]);

    const { subscribeOverBridge, pinDirectiveKey } = useStreamWiring<TDirective>(setDirective, setIsLoading, setIsLive, setError);

    const refetchHttp = useCallback(async (query: TQuery) => {
        setIsLoading(true);
        setError(null);
        try {
            const next = await recomposePost<TDirective>(query);
            /* The server rebuilds the directive's `query` from its own
             *  replayStamp and DROPS client-only drill fields — notably
             *  `periodKey`, the calendar identity the drill set. Without it the
             *  renderer falls back to windowDays/asOf day-arithmetic (which
             *  drifts a few days → an extra edge bucket like a stray 2009 in a
             *  2010s drill). Merge the requested query's periodKey back onto the
             *  returned directive so the calendar identity survives the round-trip. */
            const merged = (query as { periodKey?: string }).periodKey
                ? ({ ...next, query: { ...(next as { query?: object }).query, periodKey: (query as { periodKey?: string }).periodKey } } as TDirective)
                : next;
            setDirective(merged);
            pinDirectiveKey(query);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'recompose failed');
        } finally {
            setIsLoading(false);
        }
    }, [pinDirectiveKey]);

    /** Unified entry: subscribe over the bridge when possible (the server
     *  pushes a `directive.value`), else HTTP recompose. */
    const requestQuery = useCallback((query: TQuery) => {
        setError(null);
        if (subscribeOverBridge(query)) {
            setIsLoading(true);
            return;
        }
        return refetchHttp(query);
    }, [subscribeOverBridge, refetchHttp]);

    // Initial-mount: subscribe when a bridge is live; otherwise HTTP-refetch
    // only when persisted state diverges from the seed (the seed is already
    // correct otherwise).
    useEffect(() => {
        if (!effectiveInitialQuery) return;
        const bridge = getStreamBridge();
        if (bridge && bridge.isConnected()) {
            requestQuery(effectiveInitialQuery as TQuery);
            return;
        }
        if (needsInitialRefetch) requestQuery(effectiveInitialQuery as TQuery);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const setToggle = useCallback((toggleId: string, value: string) => {
        const cur = directive.query;
        if (!cur) return;
        const nextQuery = applyToggleToQuery(cur, directive.toggles, toggleId, value);
        if (nextQuery === cur) return; // unknown toggle / invalid value → no-op
        persistedRef.current = nextPersisted(persistedRef.current, toggleId, value);
        writePersisted(directive.persistKey, persistedRef.current);
        requestQuery(nextQuery);
    }, [directive, requestQuery]);

    const setQueryFields = useCallback((patch: Partial<TQuery>) => {
        const cur = directive.query;
        if (!cur) return;
        const keys = Object.keys(patch);
        if (keys.every(k => cur[k as keyof TQuery] === patch[k as keyof TQuery])) return;
        // Atomic fast-path: visible-window patches against an atomic directive
        // are pure client-side. `__instantUpdate` tells the animation engine
        // this is continuous slider input — snap to geometry, don't tween.
        if (isAtomicVisibleWindowPatch(directive as { atoms?: unknown[] }, keys)) {
            setDirective(prev => ({ ...prev, query: { ...cur, ...patch }, __instantUpdate: true }) as TDirective);
            return;
        }
        requestQuery({ ...cur, ...patch } as TQuery);
    }, [directive, requestQuery]);

    const refetchCurrent = useCallback(() => {
        if (directive.query) requestQuery(directive.query);
    }, [directive, requestQuery]);

    const drillDown = useCallback((childQuery: TQuery, parentLabel: string) => {
        /* Push ONE crumb for the level we're LEAVING — labelled by that view
         *  and storing it as the restore target, so clicking the crumb returns
         *  to that view (label ↔ restore aligned). The first drill's parent IS
         *  the root, so it becomes the "All" crumb (no separate seed). The
         *  CURRENT/deepest level is never a crumb — the chip renders it as the
         *  non-clickable tail from the live directive. */
        setBreadcrumbs(prev => [...prev, { label: parentLabel, directive }]);
        requestQuery(childQuery);
    }, [directive, requestQuery]);

    const drillUp = useCallback(() => {
        setBreadcrumbs(prev => {
            if (prev.length === 0) return prev;
            const last = prev[prev.length - 1];
            setDirective(last.directive);
            setError(null);
            if (last.directive.query) subscribeOverBridge(last.directive.query);
            return prev.slice(0, -1);
        });
    }, [subscribeOverBridge]);

    /** Jump straight to crumb `index` — restore the view captured BEFORE that
     *  drill and truncate the trail to it. The breadcrumb IS the level control:
     *  clicking "2010s" returns to the decade view, "All" (index 0, the root
     *  crumb) to the full timeline. Out-of-range index is a no-op. */
    const drillTo = useCallback((index: number) => {
        setBreadcrumbs(prev => {
            if (index < 0 || index >= prev.length) return prev;
            const target = prev[index];
            setDirective(target.directive);
            setError(null);
            if (target.directive.query) subscribeOverBridge(target.directive.query);
            return prev.slice(0, index);
        });
    }, [subscribeOverBridge]);

    return {
        directive,
        isLoading,
        error,
        isLive,
        setToggle,
        setQueryFields,
        refetch: refetchCurrent,
        drillDown,
        drillUp,
        drillTo,
        breadcrumbs: breadcrumbs.map(b => ({ label: b.label })),
    };
}
