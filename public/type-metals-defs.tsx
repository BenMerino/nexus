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

function polishedStops(tokenVar: string) {
  const base = `var(${tokenVar})`;
  const mix = (pct: string) => `color-mix(in oklch, var(${tokenVar}) 100%, ${pct})`;
  const specularHalf = `color-mix(in oklch, var(${tokenVar}) 70%, white 30%)`;
  const specularPeak = `color-mix(in oklch, var(${tokenVar}) 45%, white 55%)`;
  return [
    { offset: '0%',   color: mix('white 12%') },
    { offset: '18%',  color: mix('white 6%') },
    { offset: '22%',  color: specularHalf },
    { offset: '25%',  color: specularPeak },
    { offset: '28%',  color: specularHalf },
    { offset: '32%',  color: mix('white 2%') },
    { offset: '55%',  color: base },
    { offset: '100%', color: mix('black 24%') },
  ].map(s => <stop key={s.offset} offset={s.offset} stopColor={s.color} />);
}

function dullStops(tokenVar: string) {
  return [
    { offset: '0%',   mix: 'white 10%' },
    { offset: '50%',  mix: null        },
    { offset: '100%', mix: 'black 20%' },
  ].map(s => (
    <stop
      key={s.offset}
      offset={s.offset}
      stopColor={s.mix ? `color-mix(in oklch, var(${tokenVar}) 100%, ${s.mix})` : `var(${tokenVar})`}
    />
  ));
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
