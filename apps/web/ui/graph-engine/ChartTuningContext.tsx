/**
 * ChartTuningContext — fetches the resolved chart tuning at app boot
 * and exposes it via `useChartTuning`. ChartRender's geometry canvas
 * reads it on every frame, so editor sliders propagate instantly via
 * `setTuning`.
 *
 * Mirror of LoaderTuningContext for the chart pipeline.
 */

import { createContext, useContext, useEffect, useState } from 'react';
import { resolveChartTuning, type ChartTuning, type TenantDNAChartTuning } from './chart-tuning.js';

/* NEXUS per-app cosmetic: bloom OFF by default (glow 0). The shared engine's
 * DEFAULT_CHART_TUNING (synced from Zincro) carries glow 0.15; rather than fork
 * that file, nexus overrides via this provider value — the sanctioned seam for
 * shared visual identity (engine-visual-defaults handles geometry constants;
 * glow lives here). Tenant DNA can still raise it via the server fetch below. */
const NEXUS_CHART_TUNING: ChartTuning = resolveChartTuning({ glow: 0 });

interface ChartTuningContextValue {
    tuning: ChartTuning;
    /** True once the initial DNA fetch settles (success OR failure). */
    loaded: boolean;
    /** Called by the editor panel to push a new in-flight tuning value
     *  into the context. Persistence is the caller's responsibility. */
    setTuning: (next: ChartTuning) => void;
}

const ChartTuningContext = createContext<ChartTuningContextValue>({
    tuning: NEXUS_CHART_TUNING,
    loaded: false,
    setTuning: () => {},
});

interface ChartTuningProviderProps {
    tenantId: string;
    children: React.ReactNode;
}

const API_BASE = '';

export function ChartTuningProvider({ tenantId, children }: ChartTuningProviderProps) {
    const [tuning, setTuning] = useState<ChartTuning>(NEXUS_CHART_TUNING);
    const [loaded, setLoaded] = useState(false);
    useEffect(() => {
        if (!tenantId) { setLoaded(true); return; }
        const ctrl = new AbortController();
        // arch-audit-ignore: S1
        fetch(`${API_BASE}/api/architect/chart-tuning/${encodeURIComponent(tenantId)}`, { signal: ctrl.signal })
            .then(r => r.ok ? r.json() : null)
            .then(payload => {
                if (payload?.tuning) setTuning(payload.tuning as ChartTuning);
                setLoaded(true);
            })
            .catch(() => setLoaded(true));
        return () => ctrl.abort();
    }, [tenantId]);
    return (
        <ChartTuningContext.Provider value={{ tuning, loaded, setTuning }}>
            {children}
        </ChartTuningContext.Provider>
    );
}

export function useChartTuning(): ChartTuningContextValue {
    return useContext(ChartTuningContext);
}

export type { TenantDNAChartTuning };
