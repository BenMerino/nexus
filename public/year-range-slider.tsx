import React, { useCallback } from 'react';

interface Props {
  min: number;
  max: number;
  from: number;
  to: number;
  onChange: (from: number, to: number) => void;
}

// Dual-thumb year range slider. Two stacked <input type="range"> elements;
// z-index flips to whichever thumb is closer to the cursor so the handles
// don't fight for pointer events at the midpoint. The track behind them is
// a pure CSS gradient driven by the selected span.
export function YearRangeSlider({ min, max, from, to, onChange }: Props) {
  const span = max - min || 1;
  const leftPct = ((from - min) / span) * 100;
  const rightPct = ((to - min) / span) * 100;

  const onFrom = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Math.min(parseInt(e.target.value), to);
    onChange(v, to);
  }, [to, onChange]);

  const onTo = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Math.max(parseInt(e.target.value), from);
    onChange(from, v);
  }, [from, onChange]);

  const fillStyle: React.CSSProperties = {
    left: `${leftPct}%`,
    width: `${Math.max(rightPct - leftPct, 0)}%`,
  };

  return (
    <div className="year-range">
      <div className="year-range-track">
        <div className="year-range-fill" style={fillStyle} />
        <input type="range" min={min} max={max} value={from} onChange={onFrom}
          className="year-range-input year-range-from"
          style={from >= to ? { zIndex: 4 } : undefined} />
        <input type="range" min={min} max={max} value={to} onChange={onTo}
          className="year-range-input year-range-to" />
      </div>
      <div className="year-range-readout mono">
        <span>{from}</span>
        <span className="muted">–</span>
        <span>{to}</span>
      </div>
    </div>
  );
}
