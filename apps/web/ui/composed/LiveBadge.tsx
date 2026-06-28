import React from 'react';
import { StatusPill } from '../primitives/StatusPill.js';
import './live-badge.css';

/* ── LiveBadge ──────────────────────────────────────────────
 * Indicator that a directive (or any data view) is receiving Stream pushes —
 * the value updates without polling. It IS a StatusPill (success tone when
 * active, neutral when paused) + a pulsing dot in the leading slot. The pulse
 * is pure CSS (live-badge-dot), so many badges cost near-zero.
 *
 *   - active: boolean — false renders the dim/paused variant so the badge
 *     stays mounted across mode flips without layout jitter.
 *   - label?: text after the dot. Defaults to "live".
 * ──────────────────────────────────────────────────────────── */

export interface LiveBadgeProps {
    active: boolean;
    label?: string;
}

export function LiveBadge({ active, label = 'live' }: LiveBadgeProps) {
    return (
        <StatusPill
            tone={active ? 'success' : 'neutral'}
            label={label}
            leading={
                <span
                    aria-hidden
                    className={active ? 'live-badge-dot live-badge-dot--active' : 'live-badge-dot'}
                    style={{ width: '0.5rem', height: '0.5rem', borderRadius: '50%', backgroundColor: 'currentColor', display: 'inline-block' }}
                />
            }
        />
    );
}
