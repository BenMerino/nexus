import { useCallback, useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { BaseQuery } from './replayable-directive.js';
import { getStreamBridge, type StreamFrame } from './directive-stream-bridge.js';
import { applyStreamPatch } from './stream-patch.js';
import { streamKeyFromQuery } from './stream-key.js';

/* ── Directive Controller — Stream wiring ────────────────────
 * The bridge-facing half of `useDirectiveController`, extracted so the
 * hook itself stays under the N5 line cap. Owns the two streamKey refs
 * and exposes `subscribeOverBridge` plus the incoming-frame + unmount
 * effects. Dormant until an app registers a StreamBridge (Phase C); the
 * controller falls back to HTTP recompose when no bridge is connected.
 * ──────────────────────────────────────────────────────────── */

export interface StreamWiring<TDirective> {
    /** Send `stream.subscribe` for `query`, unsubscribing the previous key
     *  first. Returns true when sent (caller skips HTTP), false when no
     *  bridge is connected (caller falls back to recompose). */
    subscribeOverBridge: (query: BaseQuery) => boolean;
    /** Pin the directive's streamKey after an HTTP snapshot so later
     *  patches know the base they apply to. */
    pinDirectiveKey: (query: BaseQuery) => void;
}

export function useStreamWiring<TDirective>(
    setDirective: Dispatch<SetStateAction<TDirective>>,
    setIsLoading: Dispatch<SetStateAction<boolean>>,
    setIsLive: Dispatch<SetStateAction<boolean>>,
    setError: Dispatch<SetStateAction<string | null>>,
): StreamWiring<TDirective> {
    /** The streamKey we're currently subscribed to. */
    const activeStreamKeyRef = useRef<string | null>(null);
    /** The streamKey the directive *in state* corresponds to. Patches must
     *  match this — not just the active subscription — to avoid merging a
     *  new query's rows into a stale base (the additive-toggle bug). */
    const directiveStreamKeyRef = useRef<string | null>(null);

    const subscribeOverBridge = useCallback((query: BaseQuery): boolean => {
        const bridge = getStreamBridge();
        if (!bridge || !bridge.isConnected()) return false;
        const prev = activeStreamKeyRef.current;
        if (prev) bridge.send({ type: 'stream.unsubscribe', streamKey: prev });
        const newKey = streamKeyFromQuery(query);
        activeStreamKeyRef.current = newKey;
        if (newKey !== directiveStreamKeyRef.current) directiveStreamKeyRef.current = null;
        bridge.send({ type: 'stream.subscribe', query: query as unknown as { kind: string; tenantId: string } });
        return true;
    }, []);

    const pinDirectiveKey = useCallback((query: BaseQuery) => {
        directiveStreamKeyRef.current = streamKeyFromQuery(query);
    }, []);

    // Incoming frames: filter by the active subscription key, then apply.
    useEffect(() => {
        const bridge = getStreamBridge();
        if (!bridge) return;
        const off = bridge.onMessage((frame: StreamFrame) => {
            if (!activeStreamKeyRef.current || frame.payload.streamKey !== activeStreamKeyRef.current) return;
            if (frame.type === 'directive.value') {
                setDirective(frame.payload.value as TDirective);
                directiveStreamKeyRef.current = frame.payload.streamKey;
                setIsLoading(false);
                setIsLive(true);
                setError(null);
            } else if (frame.type === 'directive.patch') {
                if (directiveStreamKeyRef.current !== frame.payload.streamKey) return;
                setDirective(prev => applyStreamPatch(prev as Record<string, unknown>, frame.payload.patch) as TDirective);
                setIsLoading(false);
                setIsLive(true);
                setError(null);
            } else if (frame.type === 'directive.error') {
                setError(frame.payload.error);
                setIsLoading(false);
                setIsLive(false);
            }
        });
        return off;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Unmount / controller-key change: tell the bridge we're done.
    useEffect(() => {
        return () => {
            const bridge = getStreamBridge();
            const key = activeStreamKeyRef.current;
            if (bridge && key) {
                bridge.send({ type: 'stream.unsubscribe', streamKey: key });
                activeStreamKeyRef.current = null;
            }
        };
    }, []);

    return { subscribeOverBridge, pinDirectiveKey };
}
