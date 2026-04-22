import { useEffect, useRef, useState } from 'react';
import type { Camera } from './projection';

/** Ease the rendered camera toward the target on rAF so pitch/yaw changes
 *  never snap. Both angles are unclamped by the hook — callers decide limits.
 *  Returns { camera, cameraRef } — state for rendering, ref for mid-drag
 *  reads where renders aren't wanted. */
export function useCameraAnim(target: Camera): { camera: Camera; cameraRef: React.MutableRefObject<Camera> } {
  const [camera, setCamera] = useState<Camera>(target);
  const cameraRef = useRef<Camera>(target);

  useEffect(() => {
    let raf = 0;
    const step = () => {
      const cur = cameraRef.current;
      const next: Camera = {
        pitch: cur.pitch + (target.pitch - cur.pitch) * 0.2,
        yaw: cur.yaw + (target.yaw - cur.yaw) * 0.25,
        cx: target.cx,
        cy: target.cy,
      };
      const settled =
        Math.abs(next.pitch - target.pitch) < 0.001 &&
        Math.abs(next.yaw - target.yaw) < 0.001;
      if (settled) {
        cameraRef.current = target;
        setCamera(target);
        return;
      }
      cameraRef.current = next;
      setCamera(next);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target.pitch, target.yaw, target.cx, target.cy]);

  return { camera, cameraRef };
}
