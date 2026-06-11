/* ── WindowCalendar ──────────────────────────────────────────
 * A single full-month day grid for the window picker's custom range.
 * Click once to set the start, again to set the end (orderRange sorts
 * them). Days outside the timeline span are disabled. Month nav steps
 * one calendar month at a time, clamped to the span.
 *
 * This is the ONLY expandable surface — the molecule shows it (full
 * month view) or hides it; there is no nested second "expand".
 * ──────────────────────────────────────────────────────────── */

import React, { useState } from 'react';
import { BaseAction } from '../primitives/BaseAction.js';
import { BaseBox } from '../primitives/BaseBox.js';
import { BaseText } from '../primitives/BaseText.js';
import { orderRange } from './window-picker-logic.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function iso(y: number, m: number, d: number): string {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export interface WindowCalendarProps {
    /** Inclusive selectable bounds (timeline span). */
    minISO: string;
    maxISO: string;
    /** Current selected range, or null while picking. */
    range: [string, string] | null;
    /** Fired with the ordered [start, end] once both ends are picked. */
    onRange: (start: string, end: string) => void;
}

export function WindowCalendar({ minISO, maxISO, range, onRange }: WindowCalendarProps) {
    // The visible month — seed from the range end, else the max bound.
    const seed = new Date(`${(range?.[1] ?? maxISO)}T00:00:00Z`);
    const [view, setView] = useState<{ y: number; m: number }>({ y: seed.getUTCFullYear(), m: seed.getUTCMonth() });
    // Pending start: set on the first click; the second click completes the range.
    const [pendingStart, setPendingStart] = useState<string | null>(null);

    const minMs = Date.parse(`${minISO}T00:00:00Z`);
    const maxMs = Date.parse(`${maxISO}T00:00:00Z`);
    const firstDow = new Date(Date.UTC(view.y, view.m, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();

    const stepMonth = (delta: number) => {
        const d = new Date(Date.UTC(view.y, view.m + delta, 1));
        setView({ y: d.getUTCFullYear(), m: d.getUTCMonth() });
    };

    const pick = (dayISO: string) => {
        if (!pendingStart) { setPendingStart(dayISO); return; }
        const [s, e] = orderRange(pendingStart, dayISO);
        setPendingStart(null);
        onRange(s, e);
    };

    const inSelected = (dayISO: string): boolean => {
        const lo = pendingStart ?? range?.[0];
        const hi = pendingStart ? pendingStart : range?.[1];
        if (!lo || !hi) return false;
        const t = Date.parse(`${dayISO}T00:00:00Z`);
        return t >= Date.parse(`${lo}T00:00:00Z`) && t <= Date.parse(`${hi}T00:00:00Z`);
    };

    const cells: React.ReactNode[] = [];
    for (let i = 0; i < firstDow; i++) cells.push(<BaseBox key={`pad-${i}`} />);
    for (let d = 1; d <= daysInMonth; d++) {
        const dayISO = iso(view.y, view.m, d);
        const ms = Date.parse(`${dayISO}T00:00:00Z`);
        const disabled = ms < minMs || ms > maxMs;
        const selected = inSelected(dayISO);
        cells.push(
            <BaseAction
                key={dayISO}
                disabled={disabled}
                onClick={() => pick(dayISO)}
                style={{
                    border: 'none', cursor: disabled ? 'default' : 'pointer',
                    background: selected ? 'var(--accent)' : 'transparent',
                    color: disabled ? 'var(--text-subtle, var(--text-muted))' : selected ? 'var(--bg-card)' : 'var(--text-main)',
                    opacity: disabled ? 0.4 : 1,
                    borderRadius: 'var(--radius-1, 4px)', fontSize: '11px',
                    padding: '3px 0', width: '100%', textAlign: 'center',
                }}
            >
                {d}
            </BaseAction>,
        );
    }

    return (
        <BaseBox density="tight" style={{ padding: 'var(--space-2, 0.5rem)', background: 'var(--bg-card)', border: '1px solid var(--border-subtle, var(--border))', borderRadius: 'var(--radius-2, 8px)', minWidth: '15rem' }}>
            <BaseBox display="flex" direction="row" align="center" justify="between" style={{ marginBottom: 'var(--space-1, 0.25rem)' }}>
                <BaseAction onClick={() => stepMonth(-1)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}>‹</BaseAction>
                <BaseText variant="detail" weight="semibold" style={{ fontSize: '11px' }}>{MONTHS[view.m]} {view.y}</BaseText>
                <BaseAction onClick={() => stepMonth(1)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}>›</BaseAction>
            </BaseBox>
            <BaseBox style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
                {DOW.map((d, i) => (
                    <BaseText key={`dow-${i}`} variant="detail" style={{ fontSize: '9px', textAlign: 'center', color: 'var(--text-muted)' }}>{d}</BaseText>
                ))}
                {cells}
            </BaseBox>
        </BaseBox>
    );
}
