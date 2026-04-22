import React, { useEffect, useRef, useState } from 'react';
import { ForceGraph } from './force-graph';
import type { EnrichedSimNode, ProjectedEdge } from './relationship-types';
import type { ExplorerAffiliations } from './explorer-affiliations';
import type { LayerType } from './explorer-layers';

interface Props {
  nodes: EnrichedSimNode[];
  links: ProjectedEdge[];
  affiliations: ExplorerAffiliations;
  homeInstitutionId: string | null;
  egoAuthorId: string | null;
  selectedId: string | null;
  onNodeClick: (n: EnrichedSimNode) => void;
  expandedIds: Set<string>;
  onExpand: (id: string) => void;
  hoverId?: string | null;
  onHoverChange?: (id: string | null) => void;
  onHullHoverChange?: (key: string | null) => void;
  minHeight?: number;
  tilt?: number;
  layerOrder?: LayerType[];
}

export function ExplorerCanvas({ nodes, links, affiliations, homeInstitutionId, egoAuthorId, selectedId, onNodeClick, expandedIds, onExpand, hoverId, onHoverChange, onHullHoverChange, minHeight = 480, tilt = 0, layerOrder }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setSize({ w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%', height: '100%', minHeight, overflow: 'hidden' }}>
      {size && (
        <ForceGraph
          nodes={nodes}
          links={links}
          width={size.w}
          height={size.h}
          selectedId={selectedId}
          onNodeClick={onNodeClick}
          affiliations={affiliations}
          homeInstitutionId={homeInstitutionId}
          egoAuthorId={egoAuthorId}
          expandedIds={expandedIds}
          onExpand={onExpand}
          externalHoverId={hoverId ?? null}
          onHoverChange={onHoverChange}
          onHullHoverChange={onHullHoverChange}
          tilt={tilt}
          layerOrder={layerOrder}
        />
      )}
    </div>
  );
}
