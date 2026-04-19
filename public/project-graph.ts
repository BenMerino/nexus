import type { RawNode, RawEdge, TagNode, ProjectedEdge, Category, EnrichedTagNode, PaperEntry } from './relationship-types';
import { classifyNodes } from './node-classify';

/**
 * Hierarchy: Institution → Author → Journal (papers embedded as data, not nodes).
 * When expandedJournal is set, only that journal + its paper nodes are shown.
 */
export function projectGraph(
  rawNodes: RawNode[],
  rawEdges: RawEdge[],
  activeCategories: Set<Category>,
  pinnedTags: string[],
  expandedJournal?: string | null,
): { nodes: EnrichedTagNode[]; edges: ProjectedEdge[]; matchingDois: Set<string> } {
  const doiToTags = new Map<string, string[]>();
  const doiLabels = new Map<string, string>();

  for (const n of rawNodes) {
    if (n.group === 'doi') doiLabels.set(n.id, n.label);
  }
  for (const e of rawEdges) {
    const list = doiToTags.get(e.source) || [];
    list.push(e.target);
    doiToTags.set(e.source, list);
  }

  const institutions = rawNodes.filter(n => n.group === 'institution');
  const authors = rawNodes.filter(n => n.group === 'author');
  const journals = new Map(rawNodes.filter(n => n.group === 'journal').map(n => [n.id, n]));

  // Map papers to journals
  const journalPapers = new Map<string, PaperEntry[]>();
  for (const [doiId, tags] of doiToTags) {
    const jTag = tags.find(t => journals.has(t));
    if (jTag) {
      const list = journalPapers.get(jTag) || [];
      list.push({ doi: doiId.replace('doi:', ''), title: doiLabels.get(doiId) || doiId });
      journalPapers.set(jTag, list);
    }
  }

  const allNodes: TagNode[] = [];
  const allEdges: ProjectedEdge[] = [];
  const matchingDois = new Set<string>();
  const added = new Set<string>();

  function addNode(id: string, label: string, group: string, w: number, papers?: PaperEntry[], ext_id?: string) {
    if (added.has(id)) return;
    added.add(id);
    allNodes.push({ id, label, group, ext_id, doiCount: w, degree: 0, weight: w || 1, papers });
  }

  for (const inst of institutions) addNode(inst.id, inst.label, 'institution', 0, undefined, inst.id.replace(/^[^:]+:/, ''));
  for (const auth of authors) {
    addNode(auth.id, auth.label, 'author', 0, undefined, auth.id.replace(/^[^:]+:/, ''));
    for (const inst of institutions) allEdges.push({ source: inst.id, target: auth.id, weight: 1, sharedDois: [] });
  }
  for (const [jId, papers] of journalPapers) {
    if (expandedJournal && expandedJournal !== jId) continue;
    const j = journals.get(jId)!;
    addNode(j.id, j.label, 'journal', papers.length, papers, j.id.replace(/^[^:]+:/, ''));
    for (const auth of authors) allEdges.push({ source: auth.id, target: j.id, weight: papers.length, sharedDois: [] });
    for (const p of papers) matchingDois.add(p.doi);
    if (expandedJournal === jId) {
      for (const p of papers) {
        addNode('doi:' + p.doi, p.title, 'doi', 0);
        allEdges.push({ source: jId, target: 'doi:' + p.doi, weight: 1, sharedDois: [] });
      }
    }
  }

  const communityMap = new Map<string, number>();
  allNodes.forEach(n => {
    communityMap.set(n.id, n.group === 'institution' ? 0 : n.group === 'author' ? 1 : n.group === 'journal' ? 2 : 3);
  });

  const nodes = classifyNodes(allNodes, allEdges, allNodes, communityMap);
  return { nodes, edges: allEdges, matchingDois };
}
