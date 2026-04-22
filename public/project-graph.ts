import type { RawNode, RawEdge, TagNode, ProjectedEdge, Category, EnrichedTagNode, PaperEntry } from './relationship-types';
import { classifyNodes } from './node-classify';

/**
 * Structural model: every relationship is mediated by a paper. We don't
 * emit shortcut edges like "institution ↔ author" or "author ↔ journal" —
 * those always pass through the paper that brought them together. Instead
 * each DOI becomes a paper node connected directly to its institutions,
 * authors, and journal. The caller can hide paper nodes visually, but the
 * structural edges always go through them.
 *
 * When `expandedJournal` is set, only that journal + its papers are emitted.
 */
export function projectGraph(
  rawNodes: RawNode[],
  rawEdges: RawEdge[],
  activeCategories: Set<Category>,
  pinnedTags: string[],
  expandedJournal?: string | null,
  includePapers: boolean = false,
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

  const isInst = (id: string) => id.startsWith('institution:');
  const isAuth = (id: string) => id.startsWith('author:');

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
  for (const auth of authors) addNode(auth.id, auth.label, 'author', 0, undefined, auth.id.replace(/^[^:]+:/, ''));
  for (const [jId, papers] of journalPapers) {
    if (expandedJournal && expandedJournal !== jId) continue;
    const j = journals.get(jId)!;
    addNode(j.id, j.label, 'journal', papers.length, papers, j.id.replace(/^[^:]+:/, ''));
    for (const p of papers) matchingDois.add(p.doi);
  }

  // Emit paper nodes and the real edges that run through them. Every
  // institution / author / journal that co-occurs on a DOI gets an edge
  // *to that DOI*, never directly to each other.
  for (const [doiId, tags] of doiToTags) {
    const jTag = tags.find(t => journals.has(t));
    if (expandedJournal && expandedJournal !== jTag) continue;
    const instTags = tags.filter(isInst);
    const authTags = tags.filter(isAuth);
    if (instTags.length === 0 && authTags.length === 0 && !jTag) continue;
    const title = doiLabels.get(doiId) || doiId;
    addNode(doiId, title, 'doi', 0);
    for (const i of instTags) allEdges.push({ source: doiId, target: i, weight: 1, sharedDois: [doiId] });
    for (const a of authTags) allEdges.push({ source: doiId, target: a, weight: 1, sharedDois: [doiId] });
    if (jTag && added.has(jTag)) allEdges.push({ source: doiId, target: jTag, weight: 1, sharedDois: [doiId] });
  }

  // When papers are hidden (includePapers=false and no expansion), drop the
  // paper nodes we emitted — but the caller sees no inter-category edges,
  // which is structurally honest: those relationships only exist through
  // papers that aren't on screen.
  if (!includePapers && !expandedJournal) {
    const paperIds = new Set<string>();
    for (let i = allNodes.length - 1; i >= 0; i--) {
      if (allNodes[i].group === 'doi') {
        paperIds.add(allNodes[i].id);
        allNodes.splice(i, 1);
      }
    }
    for (let i = allEdges.length - 1; i >= 0; i--) {
      if (paperIds.has(allEdges[i].source) || paperIds.has(allEdges[i].target)) {
        allEdges.splice(i, 1);
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
