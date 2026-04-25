import { useEffect, useState } from 'react';

/** Drag-to-orbit: horizontal pointer delta maps to yaw, vertical delta to
 *  pitch. Both axes are unclamped — full 360° freedom in any direction.
 *
 *  Fully resets to the default pose when the parent signals the view has
 *  gone flat, so toggling back to 3D always starts from a clean pose. */
export function useOrbitDrag(
  active: boolean,
  defaultPitch: number,
  onOrbitStart?: () => void,
): {
  pitch: number;
  yaw: number;
  isOrbiting: boolean;
  startOrbitDrag: (e: React.MouseEvent) => void;
} {
  const [pitch, setPitch] = useState(defaultPitch);
  const [yaw, setYaw] = useState(0);
  const [isOrbiting, setIsOrbiting] = useState(false);

  useEffect(() => {
    if (!active) { setPitch(0); setYaw(0); return; }
    setPitch(defaultPitch);
    setYaw(0);
  }, [active, defaultPitch]);

  const startOrbitDrag = (e: React.MouseEvent) => {
    if (!active) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startYaw = yaw;
    const startPitch = pitch;
    setIsOrbiting(true);
    onOrbitStart?.();
    const onMove = (ev: MouseEvent) => {
      const dYaw = (ev.clientX - startX) * 0.006;
      const dPitch = -(ev.clientY - startY) * 0.006;
      setYaw(startYaw + dYaw);
      setPitch(startPitch + dPitch);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setIsOrbiting(false);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return { pitch, yaw, isOrbiting, startOrbitDrag };
}
