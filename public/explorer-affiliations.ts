import type { RawNode, RawEdge } from './relationship-types';

export interface ExplorerAffiliations {
  /** authorId → set of institution node ids the author shares a paper with. */
  institutionsByAuthor: Map<string, Set<string>>;
  /** authorId → set of journal node ids the author shares a paper with. */
  journalsByAuthor: Map<string, Set<string>>;
  /** doiNodeId → YYYY year string. */
  yearByDoi: Map<string, string>;
}

export function buildExplorerAffiliations(rawNodes: RawNode[], rawEdges: RawEdge[]): ExplorerAffiliations {
  const groupByNodeId = new Map<string, string>();
  for (const n of rawNodes) groupByNodeId.set(n.id, n.group);

  // Each raw edge is doi → tag (tag is author/institution/journal). Group tags by their source doi.
  const tagsByDoi = new Map<string, string[]>();
  for (const e of rawEdges) {
    const list = tagsByDoi.get(e.source) || [];
    list.push(e.target);
    tagsByDoi.set(e.source, list);
  }

  const institutionsByAuthor = new Map<string, Set<string>>();
  const journalsByAuthor = new Map<string, Set<string>>();

  for (const [, tagIds] of tagsByDoi) {
    const authors: string[] = [];
    const institutions: string[] = [];
    const journals: string[] = [];
    for (const id of tagIds) {
      const g = groupByNodeId.get(id);
      if (g === 'author') authors.push(id);
      else if (g === 'institution') institutions.push(id);
      else if (g === 'journal') journals.push(id);
    }
    for (const a of authors) {
      if (!institutionsByAuthor.has(a)) institutionsByAuthor.set(a, new Set());
      for (const i of institutions) institutionsByAuthor.get(a)!.add(i);
      if (!journalsByAuthor.has(a)) journalsByAuthor.set(a, new Set());
      for (const j of journals) journalsByAuthor.get(a)!.add(j);
    }
  }

  const yearByDoi = new Map<string, string>();
  for (const n of rawNodes) {
    if (n.group === 'doi' && n.published) yearByDoi.set(n.id, n.published.slice(0, 4));
  }

  return { institutionsByAuthor, journalsByAuthor, yearByDoi };
}
