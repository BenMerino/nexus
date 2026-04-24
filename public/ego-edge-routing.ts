import type { ProjectedEdge } from './relationship-types';

/** Route the ego author's connection to papers *through* the journals the
 *  ego has published in. Drops paper↔ego edges and adds ego↔journal edges
 *  for every journal the ego is attached to via at least one paper. All
 *  other paper↔author edges are untouched — only the ego is re-routed.
 *
 *  Structural model: the ego → journal → paper chain reflects "you
 *  published in these venues, these are the papers that appeared there."
 *  Co-authors still attach to papers directly because the data's
 *  authorship graph is most naturally expressed that way. */
export function routeEgoThroughJournals(
  edges: ProjectedEdge[],
  egoAuthorId: string | null,
): ProjectedEdge[] {
  if (!egoAuthorId) return edges;

  // Collect the papers the ego authored + the journal each paper is in.
  const egoPapers = new Set<string>();
  const journalForPaper = new Map<string, string>();
  for (const e of edges) {
    if (e.target === egoAuthorId && e.source.startsWith('doi:')) egoPapers.add(e.source);
    if (e.source === egoAuthorId && e.target.startsWith('doi:')) egoPapers.add(e.target);
    if (e.source.startsWith('doi:') && e.target.startsWith('journal:')) journalForPaper.set(e.source, e.target);
    if (e.target.startsWith('doi:') && e.source.startsWith('journal:')) journalForPaper.set(e.target, e.source);
  }

  // Distinct journals the ego has publications in.
  const egoJournals = new Set<string>();
  for (const p of egoPapers) {
    const j = journalForPaper.get(p);
    if (j) egoJournals.add(j);
  }

  // Drop paper↔ego edges, keep everything else.
  const filtered = edges.filter(e => {
    const touchesEgo = e.source === egoAuthorId || e.target === egoAuthorId;
    if (!touchesEgo) return true;
    const other = e.source === egoAuthorId ? e.target : e.source;
    return !other.startsWith('doi:');
  });

  // Add ego↔journal edges for every journal the ego has published in.
  const extra: ProjectedEdge[] = [];
  for (const jId of egoJournals) {
    extra.push({ source: egoAuthorId, target: jId, weight: 1, sharedDois: [] });
  }
  return [...filtered, ...extra];
}
