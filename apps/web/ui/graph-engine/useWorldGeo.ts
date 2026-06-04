import { useEffect, useState } from 'react';
import { useEngineConfig } from './engine-config.js';

/* ── useWorldGeo ─────────────────────────────────────────────
 * Loads the world-countries geometry the choropleth family needs, via the
 * host's `apiGet` (the engine's one fetch seam — same pattern as
 * useTimelineSpan). The asset is `{ [iso2]: { name, rings } }`, rings = arrays
 * of [lon,lat]. The host serves it statically; the engine just names the URL
 * convention. Cached in-module so every choropleth on a page shares one fetch.
 * Returns null until loaded (the family renders empty meanwhile).
 * ──────────────────────────────────────────────────────────── */

export type WorldGeo = Record<string, { name: string; rings: number[][][] }>;

const GEO_URL = '/geo/world-countries.json';

let cached: WorldGeo | null = null;
let inflight: Promise<WorldGeo> | null = null;

export function useWorldGeo(enabled: boolean): WorldGeo | null {
    const { apiGet } = useEngineConfig();
    const [geo, setGeo] = useState<WorldGeo | null>(cached);
    useEffect(() => {
        if (!enabled || cached) { if (cached) setGeo(cached); return; }
        let cancelled = false;
        if (!inflight) {
            inflight = apiGet<WorldGeo>(GEO_URL, { context: { entity: 'world-geo' } })
                .then((g) => { cached = g; return g; })
                .catch((e) => { inflight = null; throw e; });
        }
        inflight.then((g) => { if (!cancelled) setGeo(g); }).catch(() => { /* family renders empty */ });
        return () => { cancelled = true; };
    }, [enabled, apiGet]);
    return geo;
}
