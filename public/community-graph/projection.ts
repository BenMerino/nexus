/** Orthographic projection for layered graphs.
 *
 *  The scene sits on an XY plane with a Z elevation. Two camera angles:
 *    yaw   — spins the scene around the vertical (Z) axis. Horizontal drag.
 *    pitch — tumbles the scene around its horizontal (X) axis. Vertical drag.
 *
 *  Pipeline: translate to origin, yaw around Z, pitch around X, orthographic
 *  drop onto the XY screen plane, translate back. At pitch = 0 the projection
 *  is identity — the existing 2D view. Larger pitch lifts Z toward screen-up
 *  and foreshortens Y.
 */

export interface Projected { x: number; y: number }
export interface Camera { pitch: number; yaw: number; cx: number; cy: number }

export const FLAT: Camera = { pitch: 0, yaw: 0, cx: 0, cy: 0 };

export function project(n: { x: number; y: number; z: number }, cam: Camera): Projected {
  if (cam.pitch === 0 && cam.yaw === 0) return { x: n.x, y: n.y };
  const dx = n.x - cam.cx;
  const dy = n.y - cam.cy;
  const cy = Math.cos(cam.yaw);
  const sy = Math.sin(cam.yaw);
  const rx = dx * cy - dy * sy;
  const ry = dx * sy + dy * cy;
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);
  return { x: cam.cx + rx, y: cam.cy + ry * cp - n.z * sp };
}

/** Full camera transform preserving the axis into the screen. Screen x/y
 *  match project(); `depth` is camera-forward distance (larger = further
 *  from the camera). Enables back-face culling and painter's ordering
 *  across faces from different prisms. */
export function projectWithDepth(n: { x: number; y: number; z: number }, cam: Camera): { x: number; y: number; depth: number } {
  const dx = n.x - cam.cx;
  const dy = n.y - cam.cy;
  const cyaw = Math.cos(cam.yaw);
  const syaw = Math.sin(cam.yaw);
  const rx = dx * cyaw - dy * syaw;
  const ry = dx * syaw + dy * cyaw;
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);
  // Rotate (ry, z) around X by pitch. The screen-up axis gets ry*cos - z*sin;
  // the into-screen axis gets ry*sin + z*cos. Larger depth = farther away.
  return {
    x: cam.cx + rx,
    y: cam.cy + ry * cp - n.z * sp,
    depth: ry * sp + n.z * cp,
  };
}

/** Inverse: recover logical (x, y) from a projected screen point P, given
 *  the node's Z. Used while a node is being dragged. */
export function unproject(p: Projected, z: number, cam: Camera): Projected {
  if (cam.pitch === 0 && cam.yaw === 0) return { x: p.x, y: p.y };
  const cp = Math.cos(cam.pitch);
  const rx = p.x - cam.cx;
  const ry = cp === 0 ? 0 : (p.y - cam.cy + z * Math.sin(cam.pitch)) / cp;
  const cy = Math.cos(-cam.yaw);
  const sy = Math.sin(-cam.yaw);
  return { x: cam.cx + rx * cy - ry * sy, y: cam.cy + rx * sy + ry * cy };
}

export function floorShadow(x: number, y: number, cam: Camera): Projected {
  return project({ x, y, z: 0 }, cam);
}

/** How "lifted off the floor" a pitched scene feels — used for shadow
 *  opacity + spread. 0 flat, 1 at pitch ≈ π/2. */
export function pitchLift(cam: Camera): number {
  return Math.min(1, Math.max(0, Math.sin(cam.pitch)));
}
