import React from 'react';
import { SmoothedHulls, type HullGroup } from '../smoothed-hulls';
import type { Point } from '../convex-hull';
import { majorCommunities, effectiveKey } from './communities';
import type { CommunityAdapter } from './types';

type Positioned<N> = N & { x: number; y: number };

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
}

export function CommunityHulls<N>({ nodes, adapter, primaryKey, colors, minSize, focusKey, onHoverKey }: Props<N>) {
  const major = majorCommunities(nodes, adapter, primaryKey, minSize);
  const groups = new Map<string, Point[]>();
  for (const n of nodes) {
    const key = effectiveKey(n, adapter, major);
    if (!key) continue;
    const points = groups.get(key);
    if (points) points.push({ x: n.x, y: n.y });
    else groups.set(key, [{ x: n.x, y: n.y }]);
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
