import type { EnrichedSimNode } from './relationship-types';
import type { CommunityAdapter } from './community-graph';
import { OTHER_KEY, OTHER_LABEL } from './community-graph';
import { buildCommunityColors, majorCommunities, effectiveKey } from './community-graph/communities';

export interface Bucket {
  key: string;
  label: string;
  color: string;
  emphasis: boolean;
  institutions: EnrichedSimNode[];
  authors: EnrichedSimNode[];
  journals: EnrichedSimNode[];
  papers: EnrichedSimNode[];
}

function sortByWeightThenLabel(a: EnrichedSimNode, b: EnrichedSimNode) {
  const d = (b.weight || 0) - (a.weight || 0);
  return d !== 0 ? d : a.label.localeCompare(b.label);
}

export function buildBuckets(
  nodes: EnrichedSimNode[],
  adapter: CommunityAdapter<EnrichedSimNode>,
  homeInstitutionId: string | null,
  labelById: Map<string, string>,
): Bucket[] {
  const minSize = 1;
  const colors = buildCommunityColors(nodes, adapter, homeInstitutionId, minSize);
  const major = majorCommunities(nodes, adapter, homeInstitutionId, minSize);
  const map = new Map<string, Bucket>();
  const ensure = (k: string) => {
    let b = map.get(k);
    if (!b) {
      b = {
        key: k,
        label: k === OTHER_KEY ? OTHER_LABEL : (labelById.get(k) || k),
        color: colors.get(k) || '#888',
        emphasis: k === homeInstitutionId,
        institutions: [], authors: [], journals: [], papers: [],
      };
      map.set(k, b);
    }
    return b;
  };
  for (const n of nodes) {
    const key = effectiveKey(n, adapter, major);
    if (!key) continue;
    const b = ensure(key);
    if (n.group === 'institution') b.institutions.push(n);
    else if (n.group === 'author') b.authors.push(n);
    else if (n.group === 'journal') b.journals.push(n);
    else if (n.group === 'doi') b.papers.push(n);
  }
  const ordered = [...map.values()];
  ordered.sort((a, b) => {
    if (a.emphasis !== b.emphasis) return a.emphasis ? -1 : 1;
    if ((a.key === OTHER_KEY) !== (b.key === OTHER_KEY)) return a.key === OTHER_KEY ? 1 : -1;
    const sizeA = a.institutions.length + a.authors.length + a.journals.length + a.papers.length;
    const sizeB = b.institutions.length + b.authors.length + b.journals.length + b.papers.length;
    return sizeB - sizeA;
  });
  for (const b of ordered) {
    b.institutions.sort(sortByWeightThenLabel);
    b.authors.sort(sortByWeightThenLabel);
    b.journals.sort(sortByWeightThenLabel);
    b.papers.sort(sortByWeightThenLabel);
  }
  return ordered;
}
