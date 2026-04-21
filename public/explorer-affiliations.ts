import type { RawNode, RawEdge } from './relationship-types';
import type { AuthorAffiliationsMap } from './use-graph-data';

export interface ExplorerAffiliations {
  /** authorId → set of institution node ids the author is actually affiliated with. */
  institutionsByAuthor: Map<string, Set<string>>;
  /** authorId → institution node id → papers with that affiliation. */
  institutionCountsByAuthor: Map<string, Map<string, number>>;
  /** authorId → set of journal node ids the author shares a paper with. */
  journalsByAuthor: Map<string, Set<string>>;
  /** authorId → journal node id → papers they published in that journal. */
  journalCountsByAuthor: Map<string, Map<string, number>>;
  /** journalId → set of doi node ids published in that journal. */
  doisByJournal: Map<string, Set<string>>;
  /** doiNodeId → YYYY year string. */
  yearByDoi: Map<string, string>;
}

/** Build the explorer's lookup maps. The author→institution maps come from
 *  the API's authoritative affiliations (derived from doi_records.authors
 *  JSON) — this is ground truth for each author's actual affiliation.
 *  Journal/year maps still come from the doi→tag edges (those pairings are
 *  unambiguous at the paper level — one journal per DOI). */
export function buildExplorerAffiliations(
  rawNodes: RawNode[],
  rawEdges: RawEdge[],
  authoritative: AuthorAffiliationsMap,
): ExplorerAffiliations {
  const groupByNodeId = new Map<string, string>();
  for (const n of rawNodes) groupByNodeId.set(n.id, n.group);

  const institutionsByAuthor = new Map<string, Set<string>>();
  const institutionCountsByAuthor = new Map<string, Map<string, number>>();
  for (const [authorId, instMap] of Object.entries(authoritative.byAuthor)) {
    const counts = new Map<string, number>();
    const set = new Set<string>();
    for (const [instId, c] of Object.entries(instMap)) {
      counts.set(instId, c);
      set.add(instId);
    }
    institutionCountsByAuthor.set(authorId, counts);
    institutionsByAuthor.set(authorId, set);
  }

  // Journal-by-author + dois-by-journal still come from doi→tag edges: a paper
  // unambiguously has one journal, and all authors on it published there.
  const tagsByDoi = new Map<string, string[]>();
  for (const e of rawEdges) {
    const list = tagsByDoi.get(e.source) || [];
    list.push(e.target);
    tagsByDoi.set(e.source, list);
  }

  const journalsByAuthor = new Map<string, Set<string>>();
  const journalCountsByAuthor = new Map<string, Map<string, number>>();
  const doisByJournal = new Map<string, Set<string>>();
  for (const [doiId, tagIds] of tagsByDoi) {
    const authors: string[] = [];
    const journals: string[] = [];
    for (const id of tagIds) {
      const g = groupByNodeId.get(id);
      if (g === 'author') authors.push(id);
      else if (g === 'journal') journals.push(id);
    }
    for (const a of authors) {
      if (!journalsByAuthor.has(a)) journalsByAuthor.set(a, new Set());
      if (!journalCountsByAuthor.has(a)) journalCountsByAuthor.set(a, new Map());
      const counts = journalCountsByAuthor.get(a)!;
      for (const j of journals) {
        journalsByAuthor.get(a)!.add(j);
        counts.set(j, (counts.get(j) || 0) + 1);
      }
    }
    for (const j of journals) {
      if (!doisByJournal.has(j)) doisByJournal.set(j, new Set());
      doisByJournal.get(j)!.add(doiId);
    }
  }

  const yearByDoi = new Map<string, string>();
  for (const n of rawNodes) {
    if (n.group === 'doi' && n.published) yearByDoi.set(n.id, n.published.slice(0, 4));
  }

  return { institutionsByAuthor, institutionCountsByAuthor, journalsByAuthor, journalCountsByAuthor, doisByJournal, yearByDoi };
}
