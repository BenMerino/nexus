import React from 'react';
import { SmoothedHulls, type HullGroup } from '../smoothed-hulls';
import type { Point } from '../convex-hull';
import { majorCommunities, effectiveKey } from './communities';
import type { CommunityAdapter } from './types';
import { project, type Camera } from './projection';
import { PrismHulls, type PrismGroup } from './prism-hulls';

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

  // When the camera is tilted, render volumetric prisms: hulls are extruded
  // from the floor (z=0) up to each community's tallest node. When flat,
  // fall back to the existing 2D smoothed-hull renderer — it's cheaper and
  // visually identical at pitch=0.
  if (camera.pitch > PRISM_PITCH_THRESHOLD) {
    const prismByKey = new Map<string, { points: Point[]; bottomZ: number; topZ: number }>();
    for (const n of nodes) {
      const key = effectiveKey(n, adapter, major);
      if (!key) continue;
      const z = n.z ?? 0;
      const entry = prismByKey.get(key);
      if (entry) {
        entry.points.push({ x: n.x, y: n.y });
        if (z > entry.topZ) entry.topZ = z;
        if (z < entry.bottomZ) entry.bottomZ = z;
      } else {
        prismByKey.set(key, { points: [{ x: n.x, y: n.y }], bottomZ: z, topZ: z });
      }
    }
    const prismGroups: PrismGroup[] = [];
    for (const [key, { points, bottomZ, topZ }] of prismByKey) {
      const isFocus = focusKey != null && key === focusKey;
      const hasFocus = focusKey != null;
      prismGroups.push({
        key, color: colors.get(key) || '#888', points, bottomZ, topZ,
        emphasis: isFocus || (!hasFocus && key === primaryKey),
        deemphasis: hasFocus && !isFocus,
      });
    }
    return <PrismHulls groups={prismGroups} camera={camera} onHoverKey={onHoverKey} />;
  }

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
