import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Simulation } from 'd3-force';
import { buildCommunityColors, majorCommunities, effectiveKey, OTHER_KEY } from './communities';
import { startDrag } from './drag';
import { GraphScene } from './scene';
import {
  initialNodes, initialLinks, buildAnchors, createSimulation,
  type SimN, type SimL, type BaseLink,
} from './forces';
import type { CommunityAdapter, ForceConfig } from './types';
import { DEFAULT_FORCE_CONFIG } from './types';
import { useViewTransform } from './use-view-transform';

export interface CommunityGraphProps<N, L extends BaseLink> {
  nodes: N[];
  links: L[];
  adapter: CommunityAdapter<N>;
  /** Grouping key considered "home" — its hull gets emphasis + accent color. */
  primaryKey?: string | null;
  width: number;
  height: number;
  selectedId?: string | null;
  forceConfig?: Partial<ForceConfig>;
  onNodeClick?: (n: N) => void;
  /** If true, a node's position stays pinned after dragging. Useful for ego-centric views. */
  pinDraggedNodes?: boolean;
  /** Optional SVG-space transform (translate + scale) applied to the rendered graph — enables zoom/pan. */
  viewTransform?: { tx: number; ty: number; scale: number };
  /** If set, center the view on this node at the given scale (2 = 200%). */
  zoomToId?: string | null;
  zoomScale?: number;
  /** Externally-driven hover — e.g. hovering a row in a sidebar should
   *  highlight the matching node on the canvas. Overrides internal pointer hover. */
  externalHoverId?: string | null;
  /** Fires when the internal pointer hover changes so parents can mirror it. */
  onHoverChange?: (id: string | null) => void;
  /** Fires when the pointer enters/leaves a community hull. */
  onHullHoverChange?: (key: string | null) => void;
}

export function CommunityGraph<N, L extends BaseLink & { weight?: number }>({
  nodes: inNodes, links: inLinks, adapter, primaryKey = null, width, height, selectedId,
  forceConfig, onNodeClick, pinDraggedNodes = false, viewTransform, zoomToId, zoomScale = 2,
  externalHoverId, onHoverChange, onHullHoverChange,
}: CommunityGraphProps<N, L>) {
  const config: ForceConfig = { ...DEFAULT_FORCE_CONFIG, ...forceConfig };
  const svgRef = useRef<SVGSVGElement | null>(null);
  const simRef = useRef<Simulation<SimN<N>, SimL<L>> | null>(null);
  const [, tick] = useState(0);
  const [internalHoverId, setInternalHoverId] = useState<string | null>(null);
  const [hullHoverKey, setHullHoverKey] = useState<string | null>(null);
  const hoverId = externalHoverId ?? internalHoverId;

  const communityColors = useMemo(
    () => buildCommunityColors(inNodes, adapter, primaryKey, config.minCommunitySize),
    [inNodes, adapter, primaryKey, config.minCommunitySize],
  );
  const major = useMemo(
    () => majorCommunities(inNodes, adapter, primaryKey, config.minCommunitySize),
    [inNodes, adapter, primaryKey, config.minCommunitySize],
  );

  const { nodes, links } = useMemo(() => {
    const ns = initialNodes(inNodes, adapter, width, height);
    const ls = initialLinks(inLinks, ns, adapter);
    return { nodes: ns, links: ls };
    // Intentionally omit `adapter` from deps: only isEgo/getId are read here,
    // and those are stable for a given node set. Re-running on every adapter
    // identity change would reseed positions and cause visible jumps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inNodes, inLinks, width, height]);

  const anchors = useMemo(
    () => buildAnchors(nodes, adapter, primaryKey, width, height, config.minCommunitySize, config.orbitRadius),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodes, primaryKey, width, height, config.minCommunitySize, config.orbitRadius],
  );

  useEffect(() => {
    const sim = createSimulation({
      nodes, links, anchors, adapter, primaryKey, width, height, config,
      onTick: () => tick(v => v + 1),
    });
    simRef.current = sim;
    return () => { sim.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, links, anchors, primaryKey, width, height]);

  const nodeColor = (n: SimN<N>): string => {
    let communityColor: string | null = null;
    if (adapter.isEgo(n)) {
      communityColor = 'var(--accent)';
    } else {
      const key = effectiveKey(n, adapter, major);
      if (key === OTHER_KEY) communityColor = communityColors.get(OTHER_KEY) || '#b0b0b0';
      else if (key) communityColor = communityColors.get(key) || null;
    }
    const override = adapter.getNodeColor?.(n, communityColor);
    if (override) return override;
    return communityColor || 'var(--fg-muted)';
  };

  const connected = useMemo(() => {
    const focusId = hoverId || selectedId || null;
    if (!focusId) return null;
    const set = new Set<string>([focusId]);
    for (const l of links) {
      const s = typeof l.source === 'object' ? l.source.id : l.source;
      const t = typeof l.target === 'object' ? l.target.id : l.target;
      if (s === focusId) set.add(t as string);
      if (t === focusId) set.add(s as string);
    }
    return set;
  }, [hoverId, selectedId, links]);

  const ego = nodes.find(n => adapter.isEgo(n));
  const hovered = hoverId ? nodes.find(n => adapter.getId(n) === hoverId) : null;
  const showHover = hovered && !adapter.isEgo(hovered);
  const focusKey = hovered ? effectiveKey(hovered, adapter, major) : hullHoverKey;

  const handleMouseDown = (e: React.MouseEvent, node: SimN<N>) => {
    const isEgo = adapter.isEgo(node);
    startDrag(e, node, svgRef.current!, simRef.current, pinDraggedNodes || isEgo);
  };

  const { t: effectiveTransform } = useViewTransform({
    override: viewTransform, zoomToId, zoomScale, nodes, adapter, width, height,
  });

  return (
    <div style={{ position: 'relative', width, height }}>
      <GraphScene
        svgRef={svgRef} width={width} height={height}
        nodes={nodes} links={links} adapter={adapter} primaryKey={primaryKey}
        communityColors={communityColors} minCommunitySize={config.minCommunitySize}
        focusKey={focusKey} hoverId={hoverId} selectedId={selectedId ?? null} connected={connected}
        nodeColor={nodeColor}
        onHoverStart={id => { setInternalHoverId(id); onHoverChange?.(id); }}
        onHoverEnd={() => { setInternalHoverId(null); onHoverChange?.(null); }}
        onMouseDown={handleMouseDown} onNodeClick={onNodeClick}
        transform={effectiveTransform}
        ego={ego} hovered={hovered ?? null} showHover={!!showHover}
        onHullHover={k => { setHullHoverKey(k); onHullHoverChange?.(k); }}
      />
    </div>
  );
}
