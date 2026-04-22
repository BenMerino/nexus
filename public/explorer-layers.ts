/** Reorderable elevation layers for the 3D explorer. One entry per visible
 *  node group, ordered top-to-bottom in the sidebar — index 0 floats highest,
 *  last index sits lowest. The user can drag in the sidebar to reorder. */

export type LayerType = 'institution' | 'author' | 'journal' | 'paper';

export const DEFAULT_LAYER_ORDER: LayerType[] = ['institution', 'author', 'journal', 'paper'];

/** Maps the sim's node.group to the layer bucket (authors and co-authors live
 *  on the same layer; `doi` is the paper layer). */
export function layerTypeForGroup(group: string): LayerType | null {
  if (group === 'institution') return 'institution';
  if (group === 'author') return 'author';
  if (group === 'journal') return 'journal';
  if (group === 'doi') return 'paper';
  return null;
}

/** Z elevation from the layer's position in the order. Evenly spaced with
 *  the top layer at +TOP and the bottom at -BOTTOM; single-layer orders
 *  fall back to 0 (flat). */
export function layerZ(layer: LayerType | null, order: LayerType[]): number {
  if (!layer) return 0;
  const idx = order.indexOf(layer);
  if (idx < 0) return 0;
  const span = order.length - 1;
  if (span <= 0) return 0;
  const TOP = 140;
  const BOTTOM = -40;
  return TOP - (idx / span) * (TOP - BOTTOM);
}
