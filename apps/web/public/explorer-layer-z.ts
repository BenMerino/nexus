import { layerTypeForNode, layerZ, type LayerType } from './explorer-layers';

interface Args {
  n: { id: string; group: string };
  layerOrder: LayerType[];
  coauthorIds: Set<string>;
  homeInstitutionId: string | null;
  egoAuthorId: string | null;
}

/** Final Z for a node: its layer's position in the order. No intra-layer
 *  bumps — every node class has its own dedicated layer, including the
 *  ego and the home institution. */
export function explorerLayerZ({ n, layerOrder, coauthorIds, homeInstitutionId, egoAuthorId }: Args): number {
  return layerZ(layerTypeForNode(n, { coauthorIds, egoAuthorId, homeInstitutionId }), layerOrder);
}
