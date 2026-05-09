/** Reorderable elevation layers for the 3D explorer. Four distinct layers:
 *  ego, co-authors, papers, other authors. Journals aren't rendered as nodes
 *  — they exist only as community hulls that group papers. Institutions
 *  likewise aren't nodes — you + your co-authors embody your institution's
 *  network in concept. */

export type LayerType = 'ego' | 'coauthor' | 'paper' | 'author';

export const DEFAULT_LAYER_ORDER: LayerType[] = [
  'ego', 'coauthor', 'paper', 'author',
];

interface NodeContext {
  coauthorIds: Set<string>;
  egoAuthorId: string | null;
  homeInstitutionId: string | null;
}

/** Maps a sim node to its layer. The ego gets its own tier; every other
 *  node falls into the regular class layer. Journals and institutions
 *  don't map to layers because they don't render as nodes. */
export function layerTypeForNode(
  n: { id: string; group: string },
  ctx: NodeContext,
): LayerType | null {
  if (ctx.egoAuthorId && n.id === ctx.egoAuthorId) return 'ego';
  if (n.group === 'institution' || n.group === 'journal') return null;
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
