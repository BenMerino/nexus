import type { RawNode, RawEdge, TagNode, ProjectedEdge, Category, EnrichedTagNode, PaperEntry } from './relationship-types';
import { classifyNodes } from './node-classify';

/**
 * Model:
 *   - Institutions are concepts, not nodes (see earlier commits).
 *   - Journals are communities, not nodes — each paper carries its journal id
 *     so the hull renderer can group papers into journal communities, but no
 *     line connects a paper to "its journal" because there's no journal node.
 *   - Authors connect to papers directly.
 *
 * When `expandedJournal` is set, only papers in that journal are emitted.
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

  const authors = rawNodes.filter(n => n.group === 'author');
  const journals = new Map(rawNodes.filter(n => n.group === 'journal').map(n => [n.id, n]));

  const isAuth = (id: string) => id.startsWith('author:');

  const allNodes: TagNode[] = [];
  const allEdges: ProjectedEdge[] = [];
  const matchingDois = new Set<string>();
  const added = new Set<string>();

  function addNode(args: {
    id: string; label: string; group: string;
    ext_id?: string; weight?: number; papers?: PaperEntry[]; journalId?: string;
  }) {
    if (added.has(args.id)) return;
    added.add(args.id);
    const node: TagNode = {
      id: args.id, label: args.label, group: args.group,
      ext_id: args.ext_id, doiCount: 0, degree: 0,
      weight: args.weight ?? 1, papers: args.papers,
    };
    if (args.journalId) (node as TagNode & { journalId?: string }).journalId = args.journalId;
    allNodes.push(node);
  }

  for (const auth of authors) addNode({ id: auth.id, label: auth.label, group: 'author', ext_id: auth.id.replace(/^[^:]+:/, '') });

  // Emit paper nodes + paper↔author edges. Each paper remembers its journal
  // id so the hull renderer can group papers into journal communities even
  // though there's no journal node to link to.
  for (const [doiId, tags] of doiToTags) {
    const jTag = tags.find(t => journals.has(t));
    if (expandedJournal && expandedJournal !== jTag) continue;
    const authTags = tags.filter(isAuth);
    if (authTags.length === 0 && !jTag) continue;
    const title = doiLabels.get(doiId) || doiId;
    addNode({ id: doiId, label: title, group: 'doi', journalId: jTag });
    if (jTag) matchingDois.add(doiId.replace('doi:', ''));
    for (const a of authTags) allEdges.push({ source: doiId, target: a, weight: 1, sharedDois: [doiId] });
  }

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
    communityMap.set(n.id, n.group === 'author' ? 1 : 3);
  });

  const nodes = classifyNodes(allNodes, allEdges, allNodes, communityMap);
  return { nodes, edges: allEdges, matchingDois };
}
