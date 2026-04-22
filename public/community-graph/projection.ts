/** Orthographic projection for layered graphs.
 *
 *  The scene sits on an XY plane with a Z elevation. The camera orbits the
 *  scene horizontally (yaw) and tilts downward (tilt). At tilt=0 the projection
 *  is identity — the existing 2D view. As tilt rises, Z lifts nodes toward
 *  screen-up and the whole plane foreshortens vertically. Yaw rotates the
 *  XY plane around the canvas center so dragging the background spins the
 *  view like a turntable.
 */

export interface Projected { x: number; y: number }

const LIFT = 0.75;
const FORESHORTEN = 0.75;

export interface Camera { tilt: number; yaw: number; cx: number; cy: number }

export const FLAT: Camera = { tilt: 0, yaw: 0, cx: 0, cy: 0 };

export function project(n: { x: number; y: number; z: number }, cam: Camera): Projected {
  if (cam.tilt <= 0 && cam.yaw === 0) return { x: n.x, y: n.y };
  const dx = n.x - cam.cx;
  const dy = n.y - cam.cy;
  const c = Math.cos(cam.yaw);
  const s = Math.sin(cam.yaw);
  const rx = dx * c - dy * s;
  const ry = dx * s + dy * c;
  const fore = 1 - (1 - FORESHORTEN) * cam.tilt;
  return { x: cam.cx + rx, y: cam.cy + ry * fore - n.z * LIFT * cam.tilt };
}

/** Inverse: given a projected screen point P and the node's Z, return the
 *  logical (x, y) on the base plane. Used while dragging a node. */
export function unproject(p: Projected, z: number, cam: Camera): Projected {
  if (cam.tilt <= 0 && cam.yaw === 0) return { x: p.x, y: p.y };
  const fore = 1 - (1 - FORESHORTEN) * cam.tilt;
  const rx = p.x - cam.cx;
  const ry = (p.y - cam.cy + z * LIFT * cam.tilt) / fore;
  const c = Math.cos(-cam.yaw);
  const s = Math.sin(-cam.yaw);
  return { x: cam.cx + rx * c - ry * s, y: cam.cy + rx * s + ry * c };
}

export function floorShadow(x: number, y: number, cam: Camera): Projected {
  return project({ x, y, z: 0 }, cam);
}
