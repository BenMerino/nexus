import React from 'react';
import { CloudOff, AlertTriangle } from '../icons/index.js';
import { StatusPill } from '../primitives/StatusPill.js';

export interface SyncIndicatorProps {
    error?: boolean;
    slow?: boolean;
}

const iconStyle = { width: '0.875rem', height: '0.875rem' };

/* Connection state as a tinted StatusPill — the state icon rides in the pill's
 * leading slot (inherits the tone color), so the whole thing is one pill, no
 * outer wrapper. */
export function SyncIndicator({ error, slow }: SyncIndicatorProps) {
    if (error) {
        return <StatusPill tone="danger" label="Sync Error" leading={<CloudOff style={iconStyle} />} />;
    }
    if (slow) {
        return <StatusPill tone="warning" label="Sync Slow" leading={<AlertTriangle style={iconStyle} />} />;
    }
    return null;
}
