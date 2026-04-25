import { useMemo } from 'react';
import type { EnrichedSimNode, ProjectedEdge } from './relationship-types';
import type { NodeTypeFlags } from './graph-filters-sidebar';

/** Ids of author nodes that should render invisible (opacity 0) while
 *  staying in the force sim. Hovering a paper reveals that paper's authors
 *  temporarily — otherwise authors obey the flag toggles. Paper nodes are
 *  never hidden here; the paper visibility flag filters them out of the
 *  projected set earlier.
 *
 *  The sim-stable shape: this hook recomputes only the hidden set; node
 *  identity doesn't change with hover/flags, so d3-force doesn't reseed. */
export function useHiddenAuthors(
  projectedNodes: EnrichedSimNode[],
  projectedEdges: ProjectedEdge[],
  hoverId: string | null | undefined,
  coauthorIds: Set<string>,
  flags: NodeTypeFlags,
  egoAuthorId: string | null,
): Set<string> {
  return useMemo(() => {
    const hidden = new Set<string>();
    const revealed = new Set<string>();
    if (hoverId) {
      if (hoverId.startsWith('doi:')) {
        // Hovering a paper: reveal its authors.
        for (const e of projectedEdges) {
          if (e.source === hoverId && e.target.startsWith('author:')) revealed.add(e.target);
          if (e.target === hoverId && e.source.startsWith('author:')) revealed.add(e.source);
        }
      } else if (hoverId.startsWith('author:')) {
        // Hovering an author (e.g. from a sidebar row): reveal that author so
        // the highlighted node actually shows up on the canvas.
        revealed.add(hoverId);
      }
    }
    for (const n of projectedNodes) {
      if (n.group !== 'author') continue;
      if (revealed.has(n.id)) continue;
      const isCo = coauthorIds.has(n.id);
      const isEgo = n.id === egoAuthorId;
      const visibleByFlag = (isCo && flags.coauthor) || (!isCo && flags.author) || (isEgo && (flags.author || flags.coauthor));
      if (!visibleByFlag) hidden.add(n.id);
    }
    return hidden;
  }, [projectedNodes, projectedEdges, hoverId, coauthorIds, flags.author, flags.coauthor, egoAuthorId]);
}
