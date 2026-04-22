import { useEffect, useState } from 'react';

/** Drag-to-rotate: mousedown on the canvas background starts a yaw drag;
 *  horizontal pointer delta maps linearly to radians. Resets to 0 when the
 *  view goes flat so tilt-back doesn't restore a hidden rotation. */
export function useYawDrag(tiltActive: boolean): {
  yaw: number;
  startYawDrag: (e: React.MouseEvent) => void;
} {
  const [yaw, setYaw] = useState(0);

  useEffect(() => { if (!tiltActive) setYaw(0); }, [tiltActive]);

  const startYawDrag = (e: React.MouseEvent) => {
    if (!tiltActive) return;
    e.preventDefault();
    const startX = e.clientX;
    const startYaw = yaw;
    const onMove = (ev: MouseEvent) => setYaw(startYaw + (ev.clientX - startX) * 0.006);
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return { yaw, startYawDrag };
}
