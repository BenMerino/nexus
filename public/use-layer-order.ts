import { useCallback, useState } from 'react';
import { DEFAULT_LAYER_ORDER, type LayerType } from './explorer-layers';

// Bump the suffix to force everyone back to the default layer order on their
// next page load. Existing saved orders under older keys are ignored and
// eventually drop off (browsers cap localStorage size; we don't clean up).
const STORAGE_KEY = 'graph-layer-order-v7';

function load(): LayerType[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LAYER_ORDER;
    const parsed = JSON.parse(raw) as LayerType[];
    const valid = parsed.filter(t => DEFAULT_LAYER_ORDER.includes(t));
    const missing = DEFAULT_LAYER_ORDER.filter(t => !valid.includes(t));
    return [...valid, ...missing];
  } catch { return DEFAULT_LAYER_ORDER; }
}

/** Persisted layer ordering state. Survives schema drift in storage (new
 *  layers added post-write land at the bottom; removed ones are dropped). */
export function useLayerOrder(): {
  layerOrder: LayerType[];
  reorderLayer: (from: number, to: number) => void;
} {
  const [layerOrder, setLayerOrder] = useState<LayerType[]>(load);

  const reorderLayer = useCallback((from: number, to: number) => {
    setLayerOrder(prev => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  return { layerOrder, reorderLayer };
}
