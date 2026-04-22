/** Reorderable elevation layers for the 3D explorer. One entry per visible
 *  node group, ordered top-to-bottom in the sidebar — index 0 floats highest,
 *  last index sits lowest. The user can drag in the sidebar to reorder. */

export type LayerType = 'institution' | 'author' | 'coauthor' | 'journal' | 'paper';

export const DEFAULT_LAYER_ORDER: LayerType[] = ['author', 'institution', 'journal', 'paper', 'coauthor'];

/** Maps a sim node to its layer bucket. `doi` is papers; authors split into
 *  two buckets by ego-proximity — the ego (and the tenant's own authors)
 *  live on `author`, everyone else on `coauthor`. */
export function layerTypeForNode(
  n: { id: string; group: string },
  coauthorIds: Set<string>,
): LayerType | null {
  if (n.group === 'institution') return 'institution';
  if (n.group === 'journal') return 'journal';
  if (n.group === 'doi') return 'paper';
  if (n.group === 'author') return coauthorIds.has(n.id) ? 'coauthor' : 'author';
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
  const TOP = 160;
  const BOTTOM = -60;
  return TOP - (idx / span) * (TOP - BOTTOM);
}
