import React from 'react';
import { TYPE_METAL, typeGradientId } from './type-metals.js';

const POLISHED = new Set([
  'journal-article',  // 18k Gold
  'review',           // Platinum
  'conference-paper', // Silver
  'book-chapter',     // Gold-plated
  'book',             // Rose Gold
  'dataset',          // Copper
]);

// Each metal's base token has sibling *-shadow and *-highlight tokens in
// shared.css. The three tones use drifted hues (not just drifted L), which
// is what makes the gradient read as metal instead of a brightness ramp.
function tones(tokenVar: string) {
  return {
    shadow:    `var(${tokenVar}-shadow)`,
    base:      `var(${tokenVar})`,
    highlight: `var(${tokenVar}-highlight)`,
  };
}

// Polished metals: soft specular hump at 25%, then base → shadow.
// The specular peak IS the -highlight token; no white mixing, so the
// metal's hue is preserved in the bright band.
function polishedStops(tokenVar: string) {
  const { shadow, base, highlight } = tones(tokenVar);
  return [
    { offset: '0%',   color: highlight },
    { offset: '18%',  color: base },
    { offset: '22%',  color: highlight },
    { offset: '28%',  color: highlight },
    { offset: '34%',  color: base },
    { offset: '60%',  color: base },
    { offset: '100%', color: shadow },
  ].map(s => <stop key={s.offset} offset={s.offset} stopColor={s.color} />);
}

// Dull metals: plain highlight → base → shadow ramp, no specular band.
// Still uses the three-tone palette so the hue drifts naturally.
function dullStops(tokenVar: string) {
  const { shadow, base, highlight } = tones(tokenVar);
  return [
    { offset: '0%',   color: highlight },
    { offset: '35%',  color: base },
    { offset: '100%', color: shadow },
  ].map(s => <stop key={s.offset} offset={s.offset} stopColor={s.color} />);
}

export function MetalGradientDefs() {
  return (
    <defs>
      {Object.entries(TYPE_METAL).map(([type, meta]) => {
        const polished = POLISHED.has(type);
        const axis = polished
          ? { x1: '0.3', y1: '0', x2: '0.7', y2: '1' }
          : { x1: '0', y1: '0', x2: '0', y2: '1' };
        return (
          <linearGradient key={type} id={typeGradientId(type)} {...axis}>
            {polished ? polishedStops(meta.token) : dullStops(meta.token)}
          </linearGradient>
        );
      })}
    </defs>
  );
}
