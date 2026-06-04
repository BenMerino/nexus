/**
 * Animated geo family: a world choropleth. Countries are shaded by a scalar
 * value (e.g. publication count) on a sequential ramp. Geography is STATIC —
 * borders never move — so the only eased quantity is each country's fill
 * intensity (`t` ∈ [0,1]), which the lerp tweens prev→target. Shapes reuse the
 * existing `polygon` primitive, so the whole map flows through the SAME GPU
 * tessellation + render path as bars/areas (writePolygonPrim). No new primitive
 * kind, no sibling renderer.
 *
 * Geometry source: the directive's `geo` field — `{ [iso2]: { name, rings } }`
 * where each ring is an array of [lon,lat] pairs. Injected onto the directive by
 * the host (nexus DirectiveChart via useWorldGeo → apiGet), keeping `sample`
 * pure/synchronous. Absent geo → empty render (host still loading).
 *
 * Projection: equirectangular, fit into the layout box. Simplest projection;
 * poles stretch but for a flat data map that's fine and dependency-free.
 */

import { rampColor } from './scales.js';
import { cs, RAMPS } from './svg-color-schemes.js';
import type { Primitive } from './chart-primitive.types.js';
import { lerpNumber, type AnimatedFamily } from './animated-family.js';
import type { GraphDirective } from '../../architect/graph-composer.types.js';

export interface GeoLayoutInput { width: number; height: number; }

interface GeoShape {
    /** Projected screen-space rings for one country (≥1; islands = many). */
    rings: ReadonlyArray<ReadonlyArray<{ x: number; y: number }>>;
    /** Eased fill intensity 0..1 (→ rampColor). */
    t: number;
    hit: { country: string; name: string; value: number };
}
export interface GeoState {
    shapes: GeoShape[];
    /** Ramp stops (CSS vars) — held in state so primitives() shades from the
     *  eased `t` each frame. Empty fill below uses the base/border token. */
    ramp: string[];
}

type GeoEntry = { name: string; rings: number[][][] };
type GeoData = Record<string, GeoEntry>;

// Equirectangular projection fit to the box. World aspect is 2:1 (360°×180°);
// letterbox within [w,h] so the map keeps shape regardless of card ratio.
function project(rings: number[][][], w: number, h: number) {
    const scale = Math.min(w / 360, h / 180);
    const offX = (w - 360 * scale) / 2;
    const offY = (h - 180 * scale) / 2;
    return rings.map((ring) =>
        ring.map(([lon, lat]) => ({
            x: offX + (lon + 180) * scale,
            y: offY + (90 - lat) * scale,
        })),
    );
}

export const animatedGeo: AnimatedFamily<GeoState> = {
    sample(chart, layoutRaw) {
        const layout = layoutRaw as GeoLayoutInput;
        const geo = (chart as GraphDirective & { geo?: GeoData }).geo;
        const ramp = cs(chart).gradient ?? RAMPS.azure;
        if (!geo) return { shapes: [], ramp };
        // Value by ISO-alpha2 (data rows: { country, value } | { label, value }).
        const rows = (chart.data as Array<{ country?: string; label?: string; value: number }>) ?? [];
        const valByIso = new Map<string, number>();
        for (const r of rows) {
            const iso = (r.country ?? r.label ?? '').toUpperCase();
            if (iso) valByIso.set(iso, (valByIso.get(iso) ?? 0) + (Number(r.value) || 0));
        }
        // Log scale: publication counts are heavily skewed (one host country
        // dwarfs the rest). log1p keeps the long tail visible.
        const logMax = Math.log1p(Math.max(...valByIso.values(), 1)) || 1;
        const shapes: GeoShape[] = [];
        for (const iso of Object.keys(geo)) {
            const entry = geo[iso];
            const value = valByIso.get(iso) ?? 0;
            shapes.push({
                rings: project(entry.rings, layout.width, layout.height),
                t: value > 0 ? Math.log1p(value) / logMax : 0,
                hit: { country: iso, name: entry.name, value },
            });
        }
        return { shapes, ramp };
    },
    lerp(prev, target, phase) {
        const alpha = phase.alpha;
        const dRef = { value: 0 };
        const out: GeoShape[] = new Array(target.shapes.length);
        for (let i = 0; i < target.shapes.length; i++) {
            const tg = target.shapes[i];
            const pv = prev.shapes[i] ?? tg;
            // Geometry is static (same country list/rings) — ease only the fill
            // intensity so countries fade into their shade.
            out[i] = { rings: tg.rings, hit: tg.hit, t: lerpNumber(pv.t, tg.t, alpha, dRef) };
        }
        return { state: { shapes: out, ramp: target.ramp }, maxDelta: dRef.value };
    },
    primitives(state) {
        const out: Primitive[] = [];
        for (const s of state.shapes) {
            // Shade from the eased t; t≈0 countries get the faint base so the
            // map reads as a full world, not just the data countries.
            const color = s.t > 0.001 ? rampColor(state.ramp, s.t) : 'var(--border-soft)';
            for (const ring of s.rings) {
                if (ring.length < 3) continue;
                out.push({ kind: 'polygon', points: ring, color, data: s.hit });
            }
        }
        return out;
    },
};
