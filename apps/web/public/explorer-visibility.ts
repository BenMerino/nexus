import type { EnrichedSimNode, ProjectedEdge } from './relationship-types';
import type { ExplorerAffiliations } from './explorer-affiliations';

export interface VisibilityResult {
  visible: Set<string>;
  placeholder: Set<string>;
}

/** Compute which nodes are "opened" vs just shape placeholders.
 *  Roots (always visible): institutions + the ego author.
 *  Clicking an institution → reveal its authors (authors whose chosen
 *  institution is that one), which in turn reveal their papers when
 *  the author itself is expanded.
 *  Clicking an author → reveal their papers.
 *  Clicking a journal → reveal its papers. */
export function computeVisibility(
  nodes: EnrichedSimNode[],
  edges: ProjectedEdge[],
  affiliations: ExplorerAffiliations,
  egoAuthorId: string | null,
  homeInstitutionId: string | null,
  expandedIds: Set<string>,
): VisibilityResult {
  const visible = new Set<string>();
  const allIds = new Set(nodes.map(n => n.id));

  // Roots: every institution + ego.
  for (const n of nodes) {
    if (n.group === 'institution') visible.add(n.id);
  }
  if (egoAuthorId && allIds.has(egoAuthorId)) visible.add(egoAuthorId);

  // Author → their papers; Journal → their papers; Institution → its authors.
  // Build lookup tables once.
  const papersByAuthor = new Map<string, Set<string>>();
  const papersByJournal = new Map<string, Set<string>>();
  for (const e of edges) {
    if (e.target.startsWith('doi:') && e.source.startsWith('author:')) {
      const set = papersByAuthor.get(e.source) || new Set<string>();
      set.add(e.target); papersByAuthor.set(e.source, set);
    }
    if (e.source.startsWith('journal:') && e.target.startsWith('doi:')) {
      const set = papersByJournal.get(e.source) || new Set<string>();
      set.add(e.target); papersByJournal.set(e.source, set);
    }
  }

  const authorsByInstitution = new Map<string, Set<string>>();
  for (const [authorId, counts] of affiliations.institutionCountsByAuthor) {
    if (!allIds.has(authorId)) continue;
    let chosen: string | null = null;
    if (homeInstitutionId && counts.has(homeInstitutionId)) chosen = homeInstitutionId;
    else {
      let best = -1;
      for (const [instId, c] of counts) if (c > best) { best = c; chosen = instId; }
    }
    if (!chosen) continue;
    const set = authorsByInstitution.get(chosen) || new Set<string>();
    set.add(authorId); authorsByInstitution.set(chosen, set);
  }

  // Expanding a placeholder first makes it visible, then reveals its children.
  for (const id of expandedIds) {
    if (!allIds.has(id)) continue;
    visible.add(id);
    if (id.startsWith('institution:')) {
      const authors = authorsByInstitution.get(id);
      if (authors) for (const a of authors) visible.add(a);
    } else if (id.startsWith('author:')) {
      const papers = papersByAuthor.get(id);
      if (papers) for (const p of papers) visible.add(p);
    } else if (id.startsWith('journal:')) {
      const papers = papersByJournal.get(id);
      if (papers) for (const p of papers) visible.add(p);
    }
  }

  const placeholder = new Set<string>();
  for (const n of nodes) if (!visible.has(n.id)) placeholder.add(n.id);
  return { visible, placeholder };
}
