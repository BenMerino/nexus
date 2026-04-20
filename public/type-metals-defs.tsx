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
  return [
    { offset: '0%',   mix: 'white 18%' },
    { offset: '28%',  mix: 'white 8%'  },
    { offset: '55%',  mix: null        },
    { offset: '100%', mix: 'black 22%' },
  ].map(s => (
    <stop
      key={s.offset}
      offset={s.offset}
      stopColor={s.mix ? `color-mix(in oklch, var(${tokenVar}) 100%, ${s.mix})` : `var(${tokenVar})`}
    />
  ));
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
      {Object.entries(TYPE_METAL).map(([type, meta]) => (
        <linearGradient key={type} id={typeGradientId(type)} x1="0" x2="0" y1="0" y2="1">
          {POLISHED.has(type) ? polishedStops(meta.token) : dullStops(meta.token)}
        </linearGradient>
      ))}
    </defs>
  );
}
