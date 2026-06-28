import React from 'react';
import './status-pill.css';
import {
    statusPillResolve,
    type StatusKind,
    type StatusValueFor,
    type StatusTone,
} from './status-pill-dictionary';

/** DNA token per tone. Used for both label color and glass tint — the
 *  surface in `status-pill.css` mixes this into the bg-card glass layer.
 *  Retune via `--status-*` tokens in DNA, never hardcode at call sites. */
const TONE_TOKEN: Record<StatusTone, string> = {
    success: 'var(--status-success)',
    warning: 'var(--status-warning)',
    danger:  'var(--status-error)',
    info:    'var(--status-info)',
    neutral: 'var(--text-muted)',
    // True orange (hue ~45). The DNA 'orange' ramp is actually hue-70 amber, and
    // --status-warning is the same amber — both read mustard. This is the one
    // clean orange in the tone system, ≈ #f97316.
    orange:  'oklch(0.68 0.19 45)',
};

type DiscriminatedProps =
    | { [K in StatusKind]: { kind: K; value: StatusValueFor<K> } }[StatusKind]
    | { tone: StatusTone; label: string };

export type StatusPillProps = DiscriminatedProps & {
    size?: 'sm' | 'md';
    className?: string;
    /** Optional node before the label — a status dot, pulse, or small icon.
     *  Inherits the pill's tone color via currentColor. */
    leading?: React.ReactNode;
};

/** Atomic status indicator. Resolves a domain enum (orderStatus,
 *  paymentStatus, appointmentStatus, providerStatus) into a tinted pill
 *  with the right tone + human label. For one-off custom uses, pass
 *  `{ tone, label }` directly. DNA-token-driven; restyle in
 *  `status-pill.css` or `--status-*` tokens, not here.
 *
 *  Memoized: pure props in, pure DOM out. Tables can stamp 10+ instances
 *  per page — without memo, every parent re-render walks every pill. */
const StatusPillImpl: React.FC<StatusPillProps> = (props) => {
    const { size = 'sm', className, leading } = props;
    let tone: StatusTone;
    let label: string;
    if ('tone' in props) {
        tone = props.tone;
        label = props.label;
    } else {
        const resolved = statusPillResolve(props.kind, props.value);
        tone = resolved.tone;
        label = resolved.label;
    }
    const token = TONE_TOKEN[tone];
    return (
        <span
            className={`status-pill status-pill--${size}${className ? ` ${className}` : ''}`}
            style={{ color: token, ['--pill-tint' as any]: token }}
            data-tone={tone}
        >
            {leading}
            {label}
        </span>
    );
};
export const StatusPill = React.memo(StatusPillImpl);
