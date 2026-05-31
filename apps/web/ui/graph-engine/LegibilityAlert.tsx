import React from 'react';
import { BaseBox } from '../primitives/BaseBox.js';
import { BaseText } from '../primitives/BaseText.js';
import type { GraphDirective, GraphDataPoint } from '../../architect/graph-composer.types.js';

/* ── Legibility Alert ────────────────────────────────────────
 * Compact fallback shown when the container is too small to
 * render a legible chart. Displays a data summary instead.
 * Threshold Protocol: triggered when LegibilityStatus = 'illegible'.
 * ──────────────────────────────────────────────────────────── */

function summarize(data: any[]): { count: number; min: number; max: number; avg: number } {
    const vals = data.map((d: any) => d.value ?? 0).filter((v: number) => typeof v === 'number');
    if (vals.length === 0) return { count: data.length, min: 0, max: 0, avg: 0 };
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const avg = Math.round(vals.reduce((s: number, v: number) => s + v, 0) / vals.length);
    return { count: data.length, min, max, avg };
}

export function LegibilityAlert({ chart }: { chart: GraphDirective }) {
    const stats = summarize(chart.data as GraphDataPoint[]);
    return (
        <BaseBox
            pad="normal" radius="control"
            style={{
                border: '1px solid var(--status-warning, #f59e0b)',
                background: 'var(--bg-card)',
                textAlign: 'center',
            }}
        >
            <BaseText variant="detail" weight="semibold" style={{ color: 'var(--status-warning, #f59e0b)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {chart.title}
            </BaseText>
            <BaseText variant="detail" color="muted" style={{ marginTop: 'var(--space-1, 0.25rem)' }}>
                {stats.count} points · Min {stats.min} · Max {stats.max} · Avg {stats.avg}
            </BaseText>
            <BaseText variant="detail" color="muted" style={{ marginTop: 'var(--space-1, 0.25rem)', opacity: 0.6 }}>
                Expand to view chart
            </BaseText>
        </BaseBox>
    );
}
