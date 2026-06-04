import { useEffect, useState } from 'react';
import { useEngineConfig } from './engine-config.js';

/* ── useTimelineSpan ─────────────────────────────────────────
 * Fetches the genesis-to-today timeline span for a (tenantId, kind)
 * pair. Cached server-side for 5 minutes, so re-mounts are cheap.
 * The slider track represents this span literally — its left end is
 * the earliest record, its right end is today. The slider's segment
 * (a windowed `[from, to]` range) sits anywhere on that track.
 * ──────────────────────────────────────────────────────────── */

export interface TimelineSpan {
    earliest: string;
    today: string;
    totalDays: number;
}

export function useTimelineSpan(tenantId: string | undefined, kind: string | undefined): TimelineSpan | null {
    const { apiGet } = useEngineConfig();
    const [span, setSpan] = useState<TimelineSpan | null>(null);
    useEffect(() => {
        if (!tenantId || !kind) { setSpan(null); return; }
        let cancelled = false;
        apiGet<TimelineSpan>(`/api/architect/timeline-span/${tenantId}/${kind}`, {
            context: { entity: 'timeline-span', tenantId, kind },
        }).then(s => { if (!cancelled) setSpan(s); }).catch(() => { /* fall back: no span, no slider */ });
        return () => { cancelled = true; };
    }, [tenantId, kind, apiGet]);
    return span;
}

/** ISO `YYYY-MM-DD` → epoch-day index relative to span.earliest. */
export function isoToAxis(iso: string, span: TimelineSpan): number {
    const e = Date.parse(`${span.earliest}T00:00:00Z`);
    const t = Date.parse(`${iso}T00:00:00Z`);
    if (!Number.isFinite(e) || !Number.isFinite(t)) return 0;
    return Math.round((t - e) / 86_400_000);
}

/** epoch-day index → ISO `YYYY-MM-DD`. Inverse of isoToAxis. */
export function axisToIso(axis: number, span: TimelineSpan): string {
    const e = Date.parse(`${span.earliest}T00:00:00Z`);
    const d = new Date(e + Math.round(axis) * 86_400_000);
    return d.toISOString().split('T')[0];
}

/** Resolve a chart's current visible range to absolute axis positions
 * `[fromAxis, toAxis]`. Defaults: when `asOf` is absent → today; when
 * `windowDays` is null → genesis (all-time on the left). Pure helper —
 * used by the slider to render its segment, no React state. */
export function resolveAxisRange(
    span: TimelineSpan,
    windowDays: number | null,
    asOf: string | null,
): [number, number] {
    const todayAxis = span.totalDays - 1;
    const toAxis = asOf ? Math.min(todayAxis, isoToAxis(asOf, span)) : todayAxis;
    const fromAxis = windowDays === null ? 0 : Math.max(0, toAxis - (windowDays - 1));
    return [fromAxis, toAxis];
}
