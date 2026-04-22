import React from 'react';
import { SmoothedHulls, type HullGroup } from '../smoothed-hulls';
import type { Point } from '../convex-hull';
import { majorCommunities, effectiveKey } from './communities';
import type { CommunityAdapter } from './types';
import { project, type Camera } from './projection';

type Positioned<N> = N & { x: number; y: number; z?: number };

const PRISM_PITCH_THRESHOLD = 0.05;

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
  /** Camera state. Hulls wrap projected node positions. */
  camera: Camera;
}

export function CommunityHulls<N>({ nodes, adapter, primaryKey, colors, minSize, focusKey, onHoverKey, camera }: Props<N>) {
  const major = majorCommunities(nodes, adapter, primaryKey, minSize);

  // Tilted view: SVG prisms are replaced with WebGL metaball clouds in a
  // sibling <CommunityClouds> layer, so no hull is drawn from this SVG path.
  if (camera.pitch > PRISM_PITCH_THRESHOLD) return null;

  // Flat view: 2D smoothed hulls, wrapped in screen space.
  const groups = new Map<string, Point[]>();
  for (const n of nodes) {
    const key = effectiveKey(n, adapter, major);
    if (!key) continue;
    const p = project({ x: n.x, y: n.y, z: 0 }, camera);
    const points = groups.get(key);
    if (points) points.push({ x: p.x, y: p.y });
    else groups.set(key, [{ x: p.x, y: p.y }]);
  }
  const hullGroups: HullGroup[] = [];
  for (const [key, points] of groups) {
    const isFocus = focusKey != null && key === focusKey;
    const hasFocus = focusKey != null;
    hullGroups.push({
      key, color: colors.get(key) || '#888', points,
      emphasis: isFocus || (!hasFocus && key === primaryKey),
      deemphasis: hasFocus && !isFocus,
    });
  }
  return <SmoothedHulls groups={hullGroups} onHoverKey={onHoverKey} />;
}
