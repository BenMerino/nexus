import React from 'react';
import { BaseBox } from '../primitives/BaseBox.js';
import { BaseAction } from '../primitives/BaseAction.js';
import { BaseText } from '../primitives/BaseText.js';
import type { ToggleFilter } from './graph-spatial.types.js';

/* ── Toggle Bar ──────────────────────────────────────────────
 * State-Integrated Toggles: row of filter pills for series
 * visibility. Toggling a series triggers data re-render,
 * which feeds back into the DPR / semantic zoom calculation.
 * ──────────────────────────────────────────────────────────── */

export function ToggleBar({ filters, onToggle }: { filters: ToggleFilter[]; onToggle: (key: string) => void }) {
    if (filters.length < 2) return null;
    return (
        <BaseBox
            direction="row" density="tight" wrap="wrap" py="1"
            style={{ justifyContent: 'center' }}
        >
            {filters.map(f => (
                <BaseAction
                    key={f.key}
                    onClick={() => onToggle(f.key)}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 'var(--space-1, 0.25rem)',
                        padding: 'var(--space-0-5, 0.125rem) var(--space-2, 0.5rem)',
                        borderRadius: 'var(--radius-pill)',
                        border: '1px solid var(--border-ghost, var(--border-main))',
                        background: f.active ? 'var(--bg-card)' : 'transparent',
                        opacity: f.active ? 1 : 0.45,
                        cursor: 'pointer',
                        transition: 'opacity 220ms ease, background 220ms ease, transform 120ms ease',
                    }}
                    onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.96)')}
                    onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
                    onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                >
                    <BaseBox
                        style={{
                            width: 'var(--space-2, 0.5rem)',
                            height: 'var(--space-2, 0.5rem)',
                            borderRadius: 'var(--radius-pill)',
                            background: f.color,
                            flexShrink: 0,
                            transform: f.active ? 'scale(1)' : 'scale(0.7)',
                            transition: 'transform 220ms ease',
                        }}
                    />
                    <BaseText variant="detail" style={{ fontSize: '9px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {f.label}
                    </BaseText>
                </BaseAction>
            ))}
        </BaseBox>
    );
}
