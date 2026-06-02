import React, { useEffect, useState } from 'react';
import { traceOn, traceSubscribe, traceSnapshot, traceClear, type TraceEntry } from './chart-trace.js';

/* On-screen readout for chart-trace (temporary). Renders only when
 * `?charttrace=1`. Fixed bottom-right; shows the live event ring so a
 * single legend toggle's cause is readable without DevTools. REMOVE with
 * chart-trace.ts once the reload source is found. */
export function ChartTraceOverlay() {
    const [entries, setEntries] = useState<TraceEntry[]>([]);
    useEffect(() => {
        if (!traceOn()) return;
        const off = traceSubscribe(() => setEntries(traceSnapshot()));
        setEntries(traceSnapshot());
        return off;
    }, []);
    if (!traceOn()) return null;
    return (
        <div style={{
            position: 'fixed', right: 8, bottom: 8, zIndex: 99999,
            width: 380, maxHeight: '46vh', overflow: 'auto',
            background: 'rgba(0,0,0,0.88)', color: '#7CFC9A',
            font: '11px/1.35 ui-monospace, monospace', padding: '8px 10px',
            border: '1px solid #2a2a2a', borderRadius: 6, whiteSpace: 'pre-wrap',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: '#fff' }}>
                <strong>chart-trace</strong>
                <button onClick={traceClear} style={{ font: 'inherit', color: '#fff', background: '#333', border: 0, borderRadius: 3, cursor: 'pointer', padding: '1px 6px' }}>clear</button>
            </div>
            {entries.length === 0
                ? <div style={{ color: '#888' }}>toggle a legend key…</div>
                : entries.map((e, i) => (
                    <div key={i}>
                        <span style={{ color: '#888' }}>{e.t}</span>{'  '}
                        <span style={{ color: '#FFD479' }}>{e.tag}</span>
                        {e.detail ? <span style={{ color: '#9ad' }}>{' · ' + e.detail}</span> : null}
                    </div>
                ))}
        </div>
    );
}
