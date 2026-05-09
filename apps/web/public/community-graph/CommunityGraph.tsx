import React, { useMemo, useRef, useState } from 'react';
import { buildCommunityColors, majorCommunities, effectiveKey } from './communities';
import { startDrag } from './drag';
import { GraphScene } from './scene';
import { type SimN, type BaseLink } from './forces';
import type { CommunityAdapter, ForceConfig } from './types';
import { DEFAULT_FORCE_CONFIG } from './types';
import { useViewTransform } from './use-view-transform';
import { useCameraAnim } from './use-camera-anim';
import { useOrbitDrag } from './use-orbit-drag';
import { useLayerIntegration } from './use-layer-integration';
import { useCommunitySim } from './use-community-sim';
import { resolveNodeColor } from './node-color';
import { buildFocusSet } from './focus-set';
import type { Camera } from './projection';

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
  /** Tilt ∈ [0, 1] — 0 is flat top-down, 1 is the default 3D orbit pose.
   *  Drag then lets the user freely spin/tumble. */
  tilt?: number;
  /** Externally-driven hull focus — e.g. hovering a row in the sidebar
   *  should highlight the matching community hull. Overrides internal
   *  pointer hull-hover when set. */
  externalHullKey?: string | null;
}

export function CommunityGraph<N, L extends BaseLink & { weight?: number }>({
  nodes: inNodes, links: inLinks, adapter, primaryKey = null, width, height, selectedId,
  forceConfig, onNodeClick, pinDraggedNodes = false, viewTransform, zoomToId, zoomScale = 2,
  externalHoverId, onHoverChange, onHullHoverChange, tilt: tiltTarget = 0,
  externalHullKey,
}: CommunityGraphProps<N, L>) {
  const config: ForceConfig = { ...DEFAULT_FORCE_CONFIG, ...forceConfig };
  const svgRef = useRef<SVGSVGElement | null>(null);
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

  const { nodes, links, simRef } = useCommunitySim<N, L>({
    inNodes, inLinks, adapter, primaryKey, width, height, config,
    onTick: () => tick(v => v + 1),
  });

  useLayerIntegration(nodes, adapter, config.layerStrength, () => tick(v => v + 1));

  const nodeColor = (n: SimN<N>) => resolveNodeColor(n, adapter, communityColors, major);

  const ego = nodes.find(n => adapter.isEgo(n));
  const egoId = ego ? adapter.getId(ego) : null;
  const connected = useMemo(() => buildFocusSet(hoverId, selectedId, egoId, links), [hoverId, selectedId, egoId, links]);
  const hovered = hoverId ? nodes.find(n => adapter.getId(n) === hoverId) : null;
  const showHover = hovered && !adapter.isEgo(hovered);
  const focusKey = hovered ? effectiveKey(hovered, adapter, major) : (externalHullKey ?? hullHoverKey);

  const defaultPitch = tiltTarget * 0.75; // ~43° at full tilt
  const { pitch, yaw, startOrbitDrag } = useOrbitDrag(tiltTarget > 0, defaultPitch);
  const target: Camera = { pitch, yaw, cx: width / 2, cy: height / 2 };
  const { camera, cameraRef } = useCameraAnim(target);

  const handleMouseDown = (e: React.MouseEvent, node: SimN<N>) => {
    const isEgo = adapter.isEgo(node);
    startDrag(e, node, svgRef.current!, simRef.current, pinDraggedNodes || isEgo, () => cameraRef.current);
  };

  const { t: effectiveTransform } = useViewTransform({
    override: viewTransform, zoomToId, zoomToCommunityKey: externalHullKey,
    zoomToIdRelated: connected,
    zoomScale, nodes, adapter, width, height, camera,
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
        camera={camera}
        rotatable={tiltTarget > 0}
        onBackgroundMouseDown={startOrbitDrag}
      />
    </div>
  );
}
