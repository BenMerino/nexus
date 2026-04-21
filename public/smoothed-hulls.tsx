import React, { useRef } from 'react';
import { computeRawRadii, radiiToPath, type Point } from './convex-hull';

export interface HullGroup {
  key: string;
  color: string;
  points: Point[];
  emphasis?: boolean;
}

interface RingState { radii: number[]; cx: number; cy: number }

const DEFAULT_LERP_ALPHA = 0.18;
const DEFAULT_PAD = 32;
const MIN_GROUP_SIZE = 2;

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

interface Props {
  groups: HullGroup[];
  pad?: number;
  lerpAlpha?: number;
}

/** Renders one smooth flowing hull per group, with per-frame temporal smoothing
 *  so shape transitions flow instead of ticking. Generic — callers decide the
 *  grouping (institution, journal, year, community, etc.). */
export function SmoothedHulls({ groups, pad = DEFAULT_PAD, lerpAlpha = DEFAULT_LERP_ALPHA }: Props) {
  const stateRef = useRef<Map<string, RingState>>(new Map());
  const state = stateRef.current;

  const paths: { key: string; d: string; color: string; emphasis: boolean }[] = [];
  const seenKeys = new Set<string>();

  for (const g of groups) {
    if (g.points.length < MIN_GROUP_SIZE) continue;
    const cx = g.points.reduce((s, p) => s + p.x, 0) / g.points.length;
    const cy = g.points.reduce((s, p) => s + p.y, 0) / g.points.length;
    const targetRadii = computeRawRadii(g.points, cx, cy);
    const prev = state.get(g.key);

    const radii = prev
      ? prev.radii.map((r, i) => lerp(r, targetRadii[i], lerpAlpha))
      : targetRadii;
    const scx = prev ? lerp(prev.cx, cx, lerpAlpha) : cx;
    const scy = prev ? lerp(prev.cy, cy, lerpAlpha) : cy;

    state.set(g.key, { radii, cx: scx, cy: scy });
    seenKeys.add(g.key);

    paths.push({
      key: g.key,
      d: radiiToPath(radii, scx, scy, pad),
      color: g.color,
      emphasis: !!g.emphasis,
    });
  }

  for (const key of [...state.keys()]) {
    if (!seenKeys.has(key)) state.delete(key);
  }

  return (
    <g style={{ pointerEvents: 'none' }}>
      {paths.map(p => (
        <path
          key={p.key}
          d={p.d}
          fill={p.color}
          fillOpacity={p.emphasis ? 0.18 : 0.1}
          stroke={p.color}
          strokeOpacity={p.emphasis ? 0.55 : 0.35}
          strokeWidth={p.emphasis ? 1.5 : 1}
        />
      ))}
    </g>
  );
}
