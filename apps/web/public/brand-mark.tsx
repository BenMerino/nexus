import React from 'react';

// The ONE product brand mark — shared by every sidebar (public tenant pages
// AND the private authed app, N9: same shell everywhere). Replaces the old
// per-tenant logo upload; Talca sits at the foot of Volcán Descabezado Grande,
// so the mark is a glass volcano tile. 8 vertical bars, one per column,
// heights forming a mountain profile (short at the edges, tall at center);
// the two peak bars stop one cell short of the top — the crater notch.
const BAR_HEIGHTS = [2, 4, 6, 7, 7, 6, 4, 2] as const;
const GRID_ROWS = 8;

export function VolcanoMark() {
  return (
    <div className="public-logo-mark" aria-hidden="true">
      <div className="volcano-grid">
        {BAR_HEIGHTS.map((h, x) => (
          <div className="volcano-bar" key={x}>
            {Array.from({ length: GRID_ROWS }, (_, i) => GRID_ROWS - 1 - i).map(rowFromBottom => {
              const filled = rowFromBottom < h;
              const opacity = 0.35 + (0.65 * (GRID_ROWS - rowFromBottom)) / GRID_ROWS;
              return (
                <span key={rowFromBottom}
                  style={filled ? { opacity, background: 'var(--fg)' } : undefined} />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
