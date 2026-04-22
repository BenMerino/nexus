import React from 'react';

interface Props {
  tenant: string | null;
  role: string | null;
  yearFrom: number;
  yearTo: number;
  yearMin: number;
  yearMax: number;
  tilted: boolean;
  onToggleTilt: () => void;
}

/** Overlays in the graph canvas corners: context readout at top-left,
 *  2D/3D toggle at top-right. Split from the main body so the explorer
 *  file stays under the 150-line rule and so the corners can evolve
 *  (more toggles, additional readouts) without bloating it. */
export function GraphCanvasCorners({ tenant, role, yearFrom, yearTo, yearMin, yearMax, tilted, onToggleTilt }: Props) {
  const scope = (yearFrom > yearMin || yearTo < yearMax) ? `${yearFrom}–${yearTo}` : 'all years';
  return (
    <>
      <div className="canvas-corner-tl">
        <div>tenant · <em>{tenant || '—'}</em></div>
        <div>role · <em>{role || '—'}</em></div>
        <div>scope · {scope}</div>
      </div>
      <div className="canvas-corner-tr">
        <button
          className="tilt-toggle"
          data-on={tilted ? '1' : '0'}
          onClick={onToggleTilt}
          title={tilted ? 'Switch to top-down view' : 'Tilt into 3D layered view'}
        >
          <span className="tilt-glyph" />
          {tilted ? '3D' : '2D'}
        </button>
      </div>
    </>
  );
}
