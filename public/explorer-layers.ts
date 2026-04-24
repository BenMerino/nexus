/** Reorderable elevation layers for the 3D explorer. One entry per visible
 *  node class, ordered top-to-bottom in the sidebar — index 0 floats highest,
 *  last index sits lowest. Six distinct layers:
 *  ego, co-authors, papers, home institution, journals, other authors.
 *  Non-home institutions aren't a layer — "you + your co-authors" embody
 *  those institutions in concept. */

export type LayerType = 'ego' | 'coauthor' | 'paper' | 'home' | 'journal' | 'author';

export const DEFAULT_LAYER_ORDER: LayerType[] = [
  'ego', 'coauthor', 'paper', 'home', 'journal', 'author',
];

interface NodeContext {
  coauthorIds: Set<string>;
  egoAuthorId: string | null;
  homeInstitutionId: string | null;
}

/** Maps a sim node to its layer. Ego and home institution get their own
 *  tiers; every other node falls into the regular class layer. */
export function layerTypeForNode(
  n: { id: string; group: string },
  ctx: NodeContext,
): LayerType | null {
  if (ctx.egoAuthorId && n.id === ctx.egoAuthorId) return 'ego';
  if (ctx.homeInstitutionId && n.id === ctx.homeInstitutionId) return 'home';
  // Non-home institutions aren't rendered as nodes, so they don't land on a layer.
  if (n.group === 'institution') return null;
  if (n.group === 'journal') return 'journal';
  if (n.group === 'doi') return 'paper';
  if (n.group === 'author') return ctx.coauthorIds.has(n.id) ? 'coauthor' : 'author';
  return null;
}

/** Z elevation from the layer's position in the order. Evenly spaced with
 *  the top layer at +TOP and the bottom at -BOTTOM. */
export function layerZ(layer: LayerType | null, order: LayerType[]): number {
  if (!layer) return 0;
  const idx = order.indexOf(layer);
  if (idx < 0) return 0;
  const span = order.length - 1;
  if (span <= 0) return 0;
  const TOP = 200;
  const BOTTOM = -80;
  return TOP - (idx / span) * (TOP - BOTTOM);
}
