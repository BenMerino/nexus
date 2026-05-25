import React from 'react';
import { BaseBox } from '../primitives/BaseBox.js';
import { BaseText } from '../primitives/BaseText.js';
import './live-badge.css';

/* ── LiveBadge ──────────────────────────────────────────────
 * Indicator that a directive (or any data view) is receiving
 * Stream pushes — i.e. the value updates without polling or
 * refresh. Pulsing dot conveys liveness without dominating the
 * card chrome.
 *
 * Props:
 *   - active: boolean. When false, renders a muted dim variant
 *     so the badge can stay mounted across mode flips without
 *     layout jitter.
 *   - label?: text shown next to the dot. Defaults to "live".
 *
 * Phase 5 of Streams. Composed primitive — uses BaseBox/BaseText
 * + the dna `--status-success` token. Animation is pure CSS, no
 * Framer dep, so it runs at near-zero cost when many badges are
 * mounted (e.g. 6 cards on the Overview).
 * ──────────────────────────────────────────────────────────── */

export interface LiveBadgeProps {
    active: boolean;
    label?: string;
}

export function LiveBadge({ active, label = 'live' }: LiveBadgeProps) {
    const fg = active ? 'var(--status-success, #10b981)' : 'var(--text-muted)';
    const bg = active
        ? 'color-mix(in srgb, var(--status-success, #10b981) 12%, transparent)'
        : 'color-mix(in srgb, var(--text-muted) 8%, transparent)';
    return (
        <BaseBox display="inline-flex" align="center" density="tight" radius="full"
            style={{
                padding: '0.125rem 0.5rem',
                backgroundColor: bg,
                color: fg,
                fontSize: '0.625rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                lineHeight: 1,
            }}
            aria-live="polite"
            aria-label={active ? `${label} updates` : `${label} updates paused`}>
            <BaseBox
                aria-hidden
                className={active ? 'live-badge-dot live-badge-dot--active' : 'live-badge-dot'}
                style={{ width: '0.5rem', height: '0.5rem', borderRadius: '50%', backgroundColor: 'currentColor', display: 'inline-block' }}
            />
            <BaseText as="span" style={{ fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit', letterSpacing: 'inherit' }}>
                {label}
            </BaseText>
        </BaseBox>
    );
}
