// Sky palette by solar altitude (sRGB 0..255). top = sky dome (overhead),
// hor = horizon band. VOLCANIC scheme: night = grey-black dome + deep red
// horizon; day = light ash-grey dome + hot magma horizon. Only two altitudes
// are ever requested (forced day/night — see sky-mode.ts), so this is a
// straight lookup, not a curve.
type RGB = [number, number, number];
export interface Sky { top: RGB; hor: RGB; }

const NIGHT: Sky = { top: [10, 9, 14],   hor: [66, 26, 40]  }; // obsidian dome + deep red horizon (no lava)
const DAY: Sky   = { top: [92, 80, 74],  hor: [248, 94, 38] }; // light ash-grey dome → hot magma horizon

export function skyFor(alt: number): Sky {
  const sky = alt >= 0 ? DAY : NIGHT;
  return { top: [...sky.top], hor: [...sky.hor] };
}
