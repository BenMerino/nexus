import React from 'react';
import { majorCommunities, effectiveKey } from './communities';
import type { CommunityAdapter } from './types';
import type { Camera } from './projection';
import { CommunityClouds, type CloudCommunity } from './community-clouds';

const TILT_THRESHOLD = 0.05;

interface Positioned { x: number; y: number; z: number }

/** Group the sim's nodes by community key, collecting 3D positions for each.
 *  Matches the same major-community / effective-key logic the SVG hulls use,
 *  so the Three.js clouds and the 2D hulls describe the same groupings. */
export function buildCloudCommunities<N extends Positioned>(
  nodes: N[],
  adapter: CommunityAdapter<N>,
  primaryKey: string | null,
  colors: Map<string, string>,
  minSize: number,
  focusKey: string | null,
): CloudCommunity[] {
  const major = majorCommunities(nodes, adapter, primaryKey, minSize);
  const byKey = new Map<string, { key: string; color: string; nodes: Positioned[] }>();
  for (const n of nodes) {
    const key = effectiveKey(n, adapter, major);
    if (!key) continue;
    const entry = byKey.get(key);
    const pos = { x: n.x, y: n.y, z: n.z };
    if (entry) entry.nodes.push(pos);
    else byKey.set(key, { key, color: colors.get(key) || '#888', nodes: [pos] });
  }
  const hasFocus = focusKey != null;
  return [...byKey.values()].map(({ key, color, nodes: ns }) => ({
    key, color, nodes: ns,
    emphasis: (hasFocus && key === focusKey) || (!hasFocus && key === primaryKey),
    deemphasis: hasFocus && key !== focusKey,
  }));
}

interface LayerProps {
  camera: Camera;
  width: number;
  height: number;
  communities: CloudCommunity[];
}

/** Only mount the WebGL canvas when the camera is tilted — flat view keeps
 *  using the SVG SmoothedHulls path, which is cheaper and pixel-stable. */
export function CloudsLayer({ camera, width, height, communities }: LayerProps) {
  if (camera.pitch <= TILT_THRESHOLD) return null;
  if (communities.length === 0) return null;
  return <CommunityClouds communities={communities} camera={camera} width={width} height={height} />;
}
