import React, { useMemo } from 'react';
import { YearRangeSlider } from './year-range-slider';
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
  yearMin: number;
  yearMax: number;
  yearFrom: number;
  yearTo: number;
  onYearRangeChange: (from: number, to: number) => void;
  layerOrder: LayerType[];
  onReorderLayer: (from: number, to: number) => void;
  layersEnabled: boolean;
}

export function GraphFiltersSidebar({ flags, setFlag, yearMin, yearMax, yearFrom, yearTo, onYearRangeChange, layerOrder, onReorderLayer, layersEnabled }: Props) {
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

      {yearMax > yearMin && (
        <div className="filter-group">
          <div className="filter-label">Year range</div>
          <YearRangeSlider min={yearMin} max={yearMax} from={yearFrom} to={yearTo} onChange={onYearRangeChange} />
        </div>
      )}

      <div className="filter-hint mono">DRAG nodes · CLICK for detail · HOVER to isolate</div>
    </aside>
  );
}
