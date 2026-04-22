/** Isometric-style orthographic projection for 3D layered graphs.
 *
 *  Nodes carry a Z elevation (layer). The camera tilt ∈ [0, 1] linearly
 *  interpolates from pure top-down (Z invisible) to a raked angle where
 *  higher-Z nodes lift up on screen and links span visibly between layers.
 *
 *  tilt = 0  → screen = (x, y)                             (the existing 2D view)
 *  tilt > 0  → screen = (x + z · dx · tilt, y - z · dy · tilt)
 *
 *  dx, dy are chosen so that the mapping reads as a left-skewed isometric
 *  at full tilt: a unit of Z lifts 0.75 screen units up and shifts 0.35 right.
 */

export interface Projected { x: number; y: number }

const DX = 0.35;
const DY = 0.75;

export function projectXY(x: number, y: number, z: number, tilt: number): Projected {
  if (tilt <= 0) return { x, y };
  return { x: x + z * DX * tilt, y: y - z * DY * tilt };
}

export function project(n: { x: number; y: number; z: number }, tilt: number): Projected {
  return projectXY(n.x, n.y, n.z, tilt);
}

/** Node-shadow offset on the floor — a small ground-plane dot at the node's (x,y,0).
 *  Gives a subtle height cue even at tilt = 0 (the shadow sits at z=0; raised
 *  nodes render offset above it). */
export function floorShadow(x: number, y: number, tilt: number): Projected {
  return projectXY(x, y, 0, tilt);
}
