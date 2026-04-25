import React, { useMemo } from 'react';
import { LayerStack, buildLayerRows } from './layer-stack';
import type { LayerType } from './explorer-layers';

export interface NodeTypeFlags {
  institution: boolean;
  author: boolean;
  coauthor: boolean;
  journal: boolean;
  paper: boolean;
}

interface Props {
  flags: NodeTypeFlags;
  setFlag: (k: keyof NodeTypeFlags, v: boolean) => void;
  layerOrder: LayerType[];
  onReorderLayer: (from: number, to: number) => void;
  layersEnabled: boolean;
}

export function GraphFiltersSidebar({ flags, setFlag, layerOrder, onReorderLayer, layersEnabled }: Props) {
  const layerRows = useMemo(() => buildLayerRows(flags, setFlag), [flags, setFlag]);
  return (
    <aside className="graph-filters">
      <div className="filter-group">
        <div className="filter-label">
          Node types
          {layersEnabled && <span className="filter-hint-inline">· drag to reorder layers</span>}
        </div>
        <LayerStack rows={layerRows} order={layerOrder} onReorder={onReorderLayer} enabled={layersEnabled} />
      </div>
    </aside>
  );
}
