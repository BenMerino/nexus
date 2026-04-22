import React from 'react';
import { parseLabel, type LabelRun } from '../rich-label';

/** Emit one <tspan> per styled run of a rich label. Italic / bold / sub /
 *  sup tags from the source become SVG tspan attributes. Safe to drop
 *  inside any <text> — doesn't set positioning, just inline styling. */
export function RichText({ raw }: { raw: string }) {
  const runs = parseLabel(raw);
  if (runs.length === 0) return null;
  return (
    <>
      {runs.map((r, i) => (
        <tspan key={i} style={tspanStyle(r)}>{r.text}</tspan>
      ))}
    </>
  );
}

function tspanStyle(r: LabelRun): React.CSSProperties {
  const s: React.CSSProperties = {};
  if (r.italic) s.fontStyle = 'italic';
  if (r.bold) s.fontWeight = 700;
  if (r.sub || r.sup) {
    s.fontSize = '0.72em';
    s.baselineShift = r.sup ? 'super' : 'sub';
  }
  return s;
}
