import React from 'react';
import { GraphDefs, GridBackdrop, Links, Nodes } from './render';
import { CommunityHulls } from './hulls';
import { EgoLabel, HoverTooltip } from './labels';
import type { CommunityAdapter } from './types';
import type { SimN, SimL, BaseLink } from './forces';
import type { ViewTransform } from './use-view-transform';

interface Props<N, L extends BaseLink & { weight?: number }> {
  svgRef: React.RefObject<SVGSVGElement>;
  width: number;
  height: number;
  nodes: SimN<N>[];
  links: SimL<L>[];
  adapter: CommunityAdapter<N>;
  primaryKey: string | null;
  communityColors: Map<string, string>;
  minCommunitySize: number;
  focusKey: string | null;
  hoverId: string | null;
  selectedId: string | null;
  connected: Set<string> | null;
  nodeColor: (n: SimN<N>) => string;
  onHoverStart: (id: string) => void;
  onHoverEnd: () => void;
  onMouseDown: (e: React.MouseEvent, n: SimN<N>) => void;
  onNodeClick?: (n: N) => void;
  transform: ViewTransform | null;
  ego: SimN<N> | undefined;
  hovered: SimN<N> | null;
  showHover: boolean;
  onHullHover?: (key: string | null) => void;
}

export function GraphScene<N, L extends BaseLink & { weight?: number }>({
  svgRef, width, height, nodes, links, adapter, primaryKey, communityColors, minCommunitySize,
  focusKey, hoverId, selectedId, connected, nodeColor, onHoverStart, onHoverEnd, onMouseDown, onNodeClick,
  transform, ego, hovered, showHover, onHullHover,
}: Props<N, L>) {
  const t = transform
    ? `translate(${transform.tx}px, ${transform.ty}px) scale(${transform.scale})`
    : 'translate(0px, 0px) scale(1)';
  return (
    <svg ref={svgRef} width={width} height={height} style={{ display: 'block', userSelect: 'none' }}>
      <GraphDefs />
      <g style={{ transform: t, transformOrigin: '0 0' }}>
        <GridBackdrop />
        <CommunityHulls nodes={nodes} adapter={adapter} primaryKey={primaryKey} colors={communityColors} minSize={minCommunitySize} focusKey={focusKey} onHoverKey={onHullHover} />
        <Links links={links} connected={connected} />
        <Nodes
          nodes={nodes} adapter={adapter}
          hoverId={hoverId} selectedId={selectedId} connected={connected} nodeColor={nodeColor}
          onHoverStart={onHoverStart} onHoverEnd={onHoverEnd} onMouseDown={onMouseDown}
          onClick={n => onNodeClick?.(n)}
        />
        {ego && <EgoLabel ego={ego} adapter={adapter} scale={transform?.scale ?? 1} />}
        {showHover && hovered && <HoverTooltip node={hovered} adapter={adapter} scale={transform?.scale ?? 1} />}
      </g>
    </svg>
  );
}
