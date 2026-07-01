// Sky palette by solar altitude (sRGB 0..255). top = sky dome (overhead),
// mid = a middle gradient stop (night only — purple, between the black dome
// and the red horizon), hor = horizon band. VOLCANIC scheme: night = black
// dome → purple → deep red horizon; day = light ash-grey dome → hot magma
// horizon (no mid stop — top blends straight to hor). Only two altitudes are
// ever requested (forced day/night — see sky-mode.ts), so this is a straight
// lookup, not a curve.
type RGB = [number, number, number];
export interface Sky { top: RGB; mid: RGB; hor: RGB; }

const NIGHT: Sky = { top: [0, 0, 0],     mid: [40, 26, 66], hor: [175, 32, 44] }; // black dome → purple → deep magma-red horizon
const DAY: Sky   = { top: [92, 80, 74],  mid: [92, 80, 74], hor: [248, 94, 38] }; // light ash-grey dome → hot magma horizon

export function skyFor(alt: number): Sky {
  const sky = alt >= 0 ? DAY : NIGHT;
  return { top: [...sky.top], mid: [...sky.mid], hor: [...sky.hor] };
}
