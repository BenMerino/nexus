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
  const specularPrimary = `color-mix(in oklch, var(${tokenVar}) 20%, white 80%)`;
  const specularSecondary = `color-mix(in oklch, var(${tokenVar}) 55%, white 45%)`;
  return [
    { offset: '0%',   color: mix('white 14%') },
    { offset: '22%',  color: mix('white 4%') },
    { offset: '24%',  color: specularPrimary },
    { offset: '26%',  color: specularPrimary },
    { offset: '30%',  color: mix('white 2%') },
    { offset: '55%',  color: base },
    { offset: '70%',  color: mix('black 6%') },
    { offset: '72%',  color: specularSecondary },
    { offset: '74%',  color: mix('black 10%') },
    { offset: '100%', color: mix('black 26%') },
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
