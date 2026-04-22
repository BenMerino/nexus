import { layerTypeForNode, layerZ, type LayerType } from './explorer-layers';

/** Extra Z the home institution floats above the rest of its layer.
 *  Roughly half a layer-gap — high enough to read as lifted, low enough
 *  that the institution stays visually part of its own layer. */
const HOME_INSTITUTION_LIFT = 30;

/** The ego author always sits above the institution layer, no matter how
 *  the user reorders layers — it anchors the whole scene. A bigger bump
 *  than the home-institution lift so the ego never collides with its
 *  own home institution. */
const EGO_CLEARANCE = 55;

interface Args {
  n: { id: string; group: string };
  layerOrder: LayerType[];
  coauthorIds: Set<string>;
  homeInstitutionId: string | null;
  egoAuthorId: string | null;
}

/** Final Z for a node: its layer's base Z plus any distinguishing bumps for
 *  the home institution (floats above peers) and the ego author (always
 *  above the institution layer, whatever height that currently is). */
export function explorerLayerZ({ n, layerOrder, coauthorIds, homeInstitutionId, egoAuthorId }: Args): number {
  const base = layerZ(layerTypeForNode(n, coauthorIds), layerOrder);
  if (n.id === homeInstitutionId) return base + HOME_INSTITUTION_LIFT;
  if (egoAuthorId && n.id === egoAuthorId) {
    const institutionZ = layerZ('institution', layerOrder) + HOME_INSTITUTION_LIFT;
    return Math.max(base, institutionZ) + EGO_CLEARANCE;
  }
  return base;
}
