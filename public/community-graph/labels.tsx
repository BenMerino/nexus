import React from 'react';
import type { CommunityAdapter } from './types';
import { project, type Camera } from './projection';
import { RichText } from './label-runs';

type Positioned<N> = N & { x: number; y: number; z?: number };

interface EgoProps<N> {
  ego: Positioned<N>;
  adapter: CommunityAdapter<N>;
  scale: number;
  camera: Camera;
}

const TAG_STYLE = (scale: number): React.CSSProperties => ({
  pointerEvents: 'none',
  fontSize: 9 / scale,
  letterSpacing: 0.8 / scale,
  fontFamily: 'var(--mono)',
  fill: 'rgba(255,255,255,0.45)',
  paintOrder: 'stroke',
  stroke: 'rgba(0,0,0,0.6)',
  strokeWidth: 3 / scale,
  strokeLinejoin: 'round',
});

const NAME_STYLE = (scale: number, weight = 400): React.CSSProperties => ({
  pointerEvents: 'none',
  fontSize: 11 / scale,
  fontWeight: weight,
  fill: 'rgba(255,255,255,0.85)',
  paintOrder: 'stroke',
  stroke: 'rgba(0,0,0,0.6)',
  strokeWidth: 3 / scale,
  strokeLinejoin: 'round',
});

export function EgoLabel<N>({ ego, adapter, scale, camera }: EgoProps<N>) {
  const r = adapter.getRadius(ego);
  const p = project({ x: ego.x, y: ego.y, z: ego.z ?? 0 }, camera);
  const tag = adapter.getTypeTag?.(ego) ?? null;
  const nameY = p.y + r + (tag ? 24 : 14) / scale;
  const tagY = p.y + r + 12 / scale;
  return (
    <g style={{ pointerEvents: 'none' }}>
      {tag && <text x={p.x} y={tagY} textAnchor="middle" style={TAG_STYLE(scale)}>{tag}</text>}
      <text x={p.x} y={nameY} textAnchor="middle" style={NAME_STYLE(scale)}>
        <RichText raw={adapter.getLabel(ego)} />
      </text>
    </g>
  );
}

interface HoverProps<N> {
  node: Positioned<N>;
  adapter: CommunityAdapter<N>;
  scale: number;
  camera: Camera;
}

export function HoverTooltip<N>({ node, adapter, scale, camera }: HoverProps<N>) {
  const r = adapter.getRadius(node);
  const subtitle = adapter.getHoverSubtitle?.(node) ?? null;
  const footnote = adapter.getHoverFootnote?.(node) ?? null;
  const tag = adapter.getTypeTag?.(node) ?? null;
  const p = project({ x: node.x, y: node.y, z: node.z ?? 0 }, camera);
  const x = p.x;
  const y = p.y;
  const lines: string[] = [adapter.getLabel(node)];
  if (subtitle) lines.push(subtitle);
  if (footnote) lines.push(footnote);
  const line = 14 / scale;
  const extraTop = tag ? 12 / scale : 0;
  const topY = y - r - 10 / scale - (lines.length - 1) * line - extraTop;
  return (
    <g style={{ pointerEvents: 'none' }}>
      {tag && <text x={x} y={topY - 4 / scale} textAnchor="middle" style={TAG_STYLE(scale)}>{tag}</text>}
      {lines.map((l, i) => (
        <text key={i} x={x} y={topY + i * line} textAnchor="middle"
          style={{
            fontSize: (i === 0 ? 12 : 11) / scale,
            fill: i === 0 ? 'var(--fg)' : 'var(--fg-muted)',
            fontWeight: i === 0 ? 500 : 400,
            paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.7)', strokeWidth: 3 / scale, strokeLinejoin: 'round',
          }}
        ><RichText raw={l} /></text>
      ))}
    </g>
  );
}

interface PathLabelsProps<N> {
  nodes: Positioned<N>[];
  adapter: CommunityAdapter<N>;
  scale: number;
  camera: Camera;
  /** Ids that should render a label — typically the intermediate nodes on
   *  the current highlight path, which would otherwise be unlabeled. */
  ids: Set<string>;
}

/** Lightweight name labels for every node on the highlight path. Matches the
 *  ego label's styling so the chain reads consistently from start to end. */
export function PathLabels<N>({ nodes, adapter, scale, camera, ids }: PathLabelsProps<N>) {
  return (
    <g style={{ pointerEvents: 'none' }}>
      {nodes.map(n => {
        const id = adapter.getId(n);
        if (!ids.has(id)) return null;
        const r = adapter.getRadius(n);
        const p = project({ x: n.x, y: n.y, z: n.z ?? 0 }, camera);
        const tag = adapter.getTypeTag?.(n) ?? null;
        const nameY = p.y + r + (tag ? 24 : 14) / scale;
        const tagY = p.y + r + 12 / scale;
        return (
          <g key={id}>
            {tag && <text x={p.x} y={tagY} textAnchor="middle" style={TAG_STYLE(scale)}>{tag}</text>}
            <text x={p.x} y={nameY} textAnchor="middle" style={NAME_STYLE(scale)}>
              <RichText raw={adapter.getLabel(n)} />
            </text>
          </g>
        );
      })}
    </g>
  );
}
