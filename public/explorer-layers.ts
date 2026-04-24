/** Reorderable elevation layers for the 3D explorer. One entry per visible
 *  node class, ordered top-to-bottom in the sidebar — index 0 floats highest,
 *  last index sits lowest. Five distinct layers:
 *  ego, co-authors, papers, journals, other authors.
 *  Institutions (home or otherwise) aren't rendered — you + your co-authors
 *  embody your institution's network in concept. */

export type LayerType = 'ego' | 'coauthor' | 'paper' | 'journal' | 'author';

export const DEFAULT_LAYER_ORDER: LayerType[] = [
  'ego', 'coauthor', 'journal', 'paper', 'author',
];

interface NodeContext {
  coauthorIds: Set<string>;
  egoAuthorId: string | null;
  homeInstitutionId: string | null;
}

/** Maps a sim node to its layer. The ego gets its own tier; every other
 *  node falls into the regular class layer. Institutions don't map to a
 *  layer because they don't render as nodes. */
export function layerTypeForNode(
  n: { id: string; group: string },
  ctx: NodeContext,
): LayerType | null {
  if (ctx.egoAuthorId && n.id === ctx.egoAuthorId) return 'ego';
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
