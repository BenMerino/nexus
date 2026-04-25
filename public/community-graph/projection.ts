/** Perspective projection for layered graphs.
 *
 *  Scene sits on an XY plane with Z elevation. Camera angles:
 *    yaw   — spins the scene around the vertical axis.
 *    pitch — tumbles the scene forward.
 *
 *  Pipeline: translate to camera center, yaw around Z, pitch around X,
 *  then perspective-divide by depth so far things shrink toward the
 *  vanishing point and near things grow. At pitch=0 yaw=0 it collapses
 *  to the identity 2D view.
 */

export interface Projected { x: number; y: number; scale: number }
export interface Camera { pitch: number; yaw: number; cx: number; cy: number }

export const FLAT: Camera = { pitch: 0, yaw: 0, cx: 0, cy: 0 };

/** Distance from the camera to the world origin along the viewing axis.
 *  Larger D → milder perspective; smaller D → more dramatic foreshortening.
 *  Tuned so a node at z=+150 looks ~30% bigger than one at z=-150. */
const CAMERA_DISTANCE = 900;

export function project(n: { x: number; y: number; z: number }, cam: Camera): Projected {
  if (cam.pitch === 0 && cam.yaw === 0) return { x: n.x, y: n.y, scale: 1 };
  const dx = n.x - cam.cx;
  const dy = n.y - cam.cy;
  const cy = Math.cos(cam.yaw);
  const sy = Math.sin(cam.yaw);
  const rx = dx * cy - dy * sy;
  const ry = dx * sy + dy * cy;
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);
  // Camera-space coords. The camera looks down the +viewAxis direction;
  // viewAxis = ry*sin(pitch) - n.z*cos(pitch). Subtract from CAMERA_DISTANCE
  // so closer-to-camera points get a smaller divisor → larger scale.
  const camY = ry * cp - n.z * sp;
  const viewAxis = ry * sp - n.z * cp;
  const denom = Math.max(50, CAMERA_DISTANCE + viewAxis);
  const scale = CAMERA_DISTANCE / denom;
  return { x: cam.cx + rx * scale, y: cam.cy + camY * scale, scale };
}

/** Inverse: recover logical (x, y) from a projected screen point P, given
 *  the node's Z. Used while a node is being dragged. The drag handler
 *  treats the cursor as already living at the same screen point as the
 *  node, so we undo the perspective scale at the node's Z. */
export function unproject(p: Projected | { x: number; y: number }, z: number, cam: Camera): { x: number; y: number } {
  if (cam.pitch === 0 && cam.yaw === 0) return { x: p.x, y: p.y };
  // Compute the perspective scale that would apply to a node at logical
  // (cx + rx, cy + ry, z). We don't know rx/ry yet — but for dragging the
  // approximation "scale at the node's z assuming it sits near center" is
  // close enough that the cursor stays under the node.
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);
  const approxViewAxis = -z * cp;
  const denom = Math.max(50, CAMERA_DISTANCE + approxViewAxis);
  const scale = CAMERA_DISTANCE / denom;
  const rx = (p.x - cam.cx) / scale;
  const camY = (p.y - cam.cy) / scale;
  const ry = cp === 0 ? 0 : (camY + z * sp) / cp;
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
