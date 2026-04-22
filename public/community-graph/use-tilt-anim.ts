import { useEffect, useRef, useState } from 'react';

/** Ease the rendered tilt toward the target on rAF so the camera never snaps
 *  between flat and raked. Returns { tilt, tiltRef } — the state is for
 *  re-rendering, the ref is for mid-drag reads where rendering isn't wanted. */
export function useTiltAnim(target: number): { tilt: number; tiltRef: React.MutableRefObject<number> } {
  const [tilt, setTilt] = useState(target);
  const tiltRef = useRef(target);

  useEffect(() => {
    let raf = 0;
    const step = () => {
      const cur = tiltRef.current;
      const next = cur + (target - cur) * 0.15;
      if (Math.abs(next - target) < 0.001) {
        tiltRef.current = target;
        setTilt(target);
        return;
      }
      tiltRef.current = next;
      setTilt(next);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  return { tilt, tiltRef };
}
