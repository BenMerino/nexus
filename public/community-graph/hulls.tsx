import React from 'react';
import { SmoothedHulls, type HullGroup } from '../smoothed-hulls';
import type { Point } from '../convex-hull';
import { majorCommunities, effectiveKey } from './communities';
import type { CommunityAdapter } from './types';
import { project } from './projection';

type Positioned<N> = N & { x: number; y: number; z?: number };

interface Props<N> {
  nodes: Positioned<N>[];
  adapter: CommunityAdapter<N>;
  primaryKey: string | null;
  colors: Map<string, string>;
  minSize: number;
  /** Hovered hull key: this hull gets emphasis, others fade. */
  focusKey?: string | null;
  /** Fires when pointer enters/leaves a hull — enables hull-as-hover-target. */
  onHoverKey?: (key: string | null) => void;
  /** Camera tilt ∈ [0, 1]. Hulls wrap projected node positions. */
  tilt: number;
}

export function CommunityHulls<N>({ nodes, adapter, primaryKey, colors, minSize, focusKey, onHoverKey, tilt }: Props<N>) {
  const major = majorCommunities(nodes, adapter, primaryKey, minSize);
  const groups = new Map<string, Point[]>();
  for (const n of nodes) {
    const key = effectiveKey(n, adapter, major);
    if (!key) continue;
    const p = project({ x: n.x, y: n.y, z: n.z ?? 0 }, tilt);
    const points = groups.get(key);
    if (points) points.push({ x: p.x, y: p.y });
    else groups.set(key, [{ x: p.x, y: p.y }]);
  }
  const hullGroups: HullGroup[] = [];
  for (const [key, points] of groups) {
    const isFocus = focusKey != null && key === focusKey;
    const hasFocus = focusKey != null;
    hullGroups.push({
      key,
      color: colors.get(key) || '#888',
      points,
      emphasis: isFocus || (!hasFocus && key === primaryKey),
      deemphasis: hasFocus && !isFocus,
    });
  }
  return <SmoothedHulls groups={hullGroups} onHoverKey={onHoverKey} />;
}
