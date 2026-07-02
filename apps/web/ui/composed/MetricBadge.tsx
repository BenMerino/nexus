import React from 'react';
import { TrendingUp, TrendingDown, Minus } from '../icons/index.js';
import { StatusPill } from '../primitives/StatusPill.js';
import type { StatusTone } from '../primitives/status-pill-dictionary.js';
import type { MetricType, ColorSentiment } from '../../architect/graph-composer.types.js';

/* ── MetricBadge ────────────────────────────────────────────
 * Context-aware trend indicator. IS a StatusPill — the metric→direction
 * sentiment maps to the pill's tone, the trend arrow rides the leading slot,
 * the value is the label. Sentiment logic (revenue-down=negative, occupancy-
 * down=warning…) is the behavior MetricBadge owns; the pill owns the look.
 * ──────────────────────────────────────────────────────────── */

export type TrendDirection = 'up' | 'down' | 'flat';

export interface MetricBadgeProps {
    value: string;
    direction?: TrendDirection;
    metric?: MetricType;
    sentiment?: ColorSentiment;
    size?: 'sm' | 'md';
}

const ICON_SIZE_SM = { width: '0.75rem', height: '0.75rem' };
const ICON_SIZE_MD = { width: '0.875rem', height: '0.875rem' };

/** Sentiment → StatusPill tone (positive=success, negative=danger). */
const SENTIMENT_TONE: Record<ColorSentiment, StatusTone> = {
    positive: 'success', negative: 'danger', warning: 'warning', neutral: 'neutral',
};

function resolveSentiment(direction: TrendDirection, metric?: MetricType): ColorSentiment {
    if (direction === 'flat') return 'neutral';
    if (!metric || metric === 'general') return direction === 'up' ? 'positive' : 'negative';
    switch (metric) {
        case 'revenue':
        case 'appointments': return direction === 'up' ? 'positive' : 'negative';
        case 'occupancy':    return direction === 'up' ? 'positive' : 'warning';
        case 'efficiency':   return direction === 'up' ? 'positive' : 'negative';
        case 'commission':   return 'neutral';
        case 'ranking':      return direction === 'up' ? 'positive' : 'warning';
        default:             return direction === 'up' ? 'positive' : 'negative';
    }
}

export function MetricBadge({ value, direction = 'up', metric, sentiment, size = 'sm' }: MetricBadgeProps) {
    const resolved = sentiment ?? resolveSentiment(direction, metric);
    const iconStyle = size === 'sm' ? ICON_SIZE_SM : ICON_SIZE_MD;
    const Icon = direction === 'up' ? TrendingUp : direction === 'down' ? TrendingDown : Minus;

    return (
        <StatusPill
            tone={SENTIMENT_TONE[resolved]}
            label={value}
            size={size}
            leading={<Icon style={iconStyle} aria-hidden />}
        />
    );
}
