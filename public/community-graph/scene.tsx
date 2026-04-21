import React from 'react';
import { GraphDefs, Links, Nodes } from './render';
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
  hoverId: string | null;
  selectedId: string | null;
  connected: Set<string> | null;
  nodeColor: (n: SimN<N>) => string;
  onHoverStart: (id: string) => void;
  onHoverEnd: () => void;
  onMouseDown: (e: React.MouseEvent, n: SimN<N>) => void;
  onNodeClick?: (n: N) => void;
  transform: ViewTransform | null;
  animate: boolean;
  ego: SimN<N> | undefined;
  hovered: SimN<N> | null;
  showHover: boolean;
}

export function GraphScene<N, L extends BaseLink & { weight?: number }>({
  svgRef, width, height, nodes, links, adapter, primaryKey, communityColors, minCommunitySize,
  hoverId, selectedId, connected, nodeColor, onHoverStart, onHoverEnd, onMouseDown, onNodeClick,
  transform, animate, ego, hovered, showHover,
}: Props<N, L>) {
  const t = transform ? `translate(${transform.tx} ${transform.ty}) scale(${transform.scale})` : undefined;
  return (
    <svg ref={svgRef} width={width} height={height} style={{ display: 'block', userSelect: 'none' }}>
      <GraphDefs />
      <g transform={t} style={{ transition: animate ? 'transform 400ms cubic-bezier(0.4, 0, 0.2, 1)' : 'none' }}>
        <CommunityHulls nodes={nodes} adapter={adapter} primaryKey={primaryKey} colors={communityColors} minSize={minCommunitySize} />
        <Links links={links} connected={connected} />
        <Nodes
          nodes={nodes} adapter={adapter}
          hoverId={hoverId} selectedId={selectedId} connected={connected} nodeColor={nodeColor}
          onHoverStart={onHoverStart} onHoverEnd={onHoverEnd} onMouseDown={onMouseDown}
          onClick={n => onNodeClick?.(n)}
        />
        {ego && <EgoLabel ego={ego} adapter={adapter} />}
        {showHover && hovered && <HoverTooltip node={hovered} adapter={adapter} />}
      </g>
    </svg>
  );
}
