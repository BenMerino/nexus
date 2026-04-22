import { layerTypeForNode, layerZ, type LayerType } from './explorer-layers';

/** Small intra-layer bumps that distinguish the home institution and the ego
 *  author from their peers without shoving them into the layer above.
 *
 *  The layer gap is 50 Z units (see explorer-layers.ts). A bump of 12 keeps
 *  the bumped node well inside its own tier (base + 12 ≪ base + 50), so the
 *  sidebar's top-to-bottom order still matches the graph's actual stacking.
 */
const INTRA_LAYER_BUMP = 12;

interface Args {
  n: { id: string; group: string };
  layerOrder: LayerType[];
  coauthorIds: Set<string>;
  homeInstitutionId: string | null;
  egoAuthorId: string | null;
}

/** Final Z for a node: its layer's base plus a small intra-layer bump when
 *  the node is the tenant's home institution or the ego author. The bump
 *  reads as "primus inter pares" within the layer, never as "promoted to
 *  the layer above." */
export function explorerLayerZ({ n, layerOrder, coauthorIds, homeInstitutionId, egoAuthorId }: Args): number {
  const base = layerZ(layerTypeForNode(n, coauthorIds), layerOrder);
  if (n.id === homeInstitutionId) return base + INTRA_LAYER_BUMP;
  if (egoAuthorId && n.id === egoAuthorId) return base + INTRA_LAYER_BUMP;
  return base;
}
