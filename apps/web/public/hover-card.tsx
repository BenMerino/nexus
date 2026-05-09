import React, { useMemo } from 'react';
import type { EnrichedSimNode, ProjectedEdge } from './relationship-types';
import { RichHtml } from './rich-text';
import { shortestPath } from './community-graph/connected-set';

interface Props {
  node: EnrichedSimNode;
  nodes: EnrichedSimNode[];
  edges: ProjectedEdge[];
  egoAuthorId: string | null;
  homeInstitutionId: string | null;
  coauthorIds: Set<string>;
}

/** Glass panel pinned to the top of the sidebar while a node is hovered.
 *  Shows what the node is, the relationships it carries, and how it ties
 *  back to the ego. Click flow is unchanged — this is a hover preview
 *  that dismisses on mouse-leave. */
export function HoverCard({ node, nodes, edges, egoAuthorId, homeInstitutionId, coauthorIds }: Props) {
  const nodesById = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);
  const typeTag = useMemo(() => tagFor(node, coauthorIds, egoAuthorId, homeInstitutionId), [node, coauthorIds, egoAuthorId, homeInstitutionId]);
  const subtitle = useMemo(() => subtitleFor(node, edges, nodesById), [node, edges, nodesById]);
  const neighborCounts = useMemo(() => countNeighborsByType(node.id, edges, nodesById), [node.id, edges, nodesById]);
  const path = useMemo(() => buildPath(node.id, egoAuthorId, edges, nodesById), [node.id, egoAuthorId, edges, nodesById]);

  return (
    <div className="hover-card">
      <div className="hover-card-tag">{typeTag}</div>
      <div className="hover-card-name"><RichHtml raw={node.label} /></div>
      {subtitle && <div className="hover-card-sub">{subtitle}</div>}
      {neighborCounts.length > 0 && (
        <div className="hover-card-counts">
          {neighborCounts.map(c => (
            <div key={c.label} className="hover-card-count">
              <span className="hover-card-count-num">{c.count}</span>
              <span className="hover-card-count-label">{c.label}</span>
            </div>
          ))}
        </div>
      )}
      {path && path.length > 1 && (
        <div className="hover-card-path">
          <div className="hover-card-path-head">Path</div>
          <ol>
            {path.map((id, i) => {
              const n = nodesById.get(id);
              if (!n) return null;
              const step = tagFor(n, coauthorIds, egoAuthorId, homeInstitutionId).toLowerCase();
              return (
                <li key={id}>
                  <span className="hover-card-path-step">{step}</span>
                  <span className="hover-card-path-label"><RichHtml raw={n.label} /></span>
                  {i < path.length - 1 && <span className="hover-card-path-arrow">↓</span>}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}

function tagFor(n: EnrichedSimNode, coauthorIds: Set<string>, _egoAuthorId: string | null, homeInstitutionId: string | null): string {
  if (n.id === homeInstitutionId) return 'YOUR INSTITUTION';
  if (n.group === 'institution') return 'INSTITUTION';
  if (n.group === 'journal') return 'JOURNAL';
  if (n.group === 'doi') return 'PAPER';
  if (n.group === 'author') return coauthorIds.has(n.id) ? 'CO-AUTHOR' : 'AUTHOR';
  return 'NODE';
}

function subtitleFor(n: EnrichedSimNode, edges: ProjectedEdge[], nodesById: Map<string, EnrichedSimNode>): string | null {
  if (n.group === 'author') {
    for (const e of edges) {
      const other = e.source === n.id ? e.target : e.target === n.id ? e.source : null;
      if (!other) continue;
      const inst = nodesById.get(other);
      if (inst && inst.group === 'institution') return `at ${inst.label}`;
    }
    return null;
  }
  if (n.group === 'doi') {
    for (const e of edges) {
      const other = e.source === n.id ? e.target : e.target === n.id ? e.source : null;
      if (!other) continue;
      const j = nodesById.get(other);
      if (j && j.group === 'journal') return `in ${j.label}`;
    }
    return null;
  }
  return null;
}

interface NeighborCount { label: string; count: number }

function countNeighborsByType(id: string, edges: ProjectedEdge[], nodesById: Map<string, EnrichedSimNode>): NeighborCount[] {
  const counts = new Map<string, Set<string>>();
  for (const e of edges) {
    const other = e.source === id ? e.target : e.target === id ? e.source : null;
    if (!other) continue;
    const n = nodesById.get(other);
    if (!n) continue;
    const bucket = n.group === 'doi' ? 'papers'
      : n.group === 'institution' ? 'institutions'
      : n.group === 'journal' ? 'journals'
      : n.group === 'author' ? 'people'
      : null;
    if (!bucket) continue;
    let set = counts.get(bucket);
    if (!set) { set = new Set(); counts.set(bucket, set); }
    set.add(other);
  }
  const order = ['papers', 'people', 'journals', 'institutions'];
  return order.filter(k => counts.has(k)).map(k => ({ label: k, count: counts.get(k)!.size }));
}

function buildPath(fromId: string, egoId: string | null, edges: ProjectedEdge[], nodesById: Map<string, EnrichedSimNode>): string[] | null {
  if (!egoId || fromId === egoId) return null;
  const path = shortestPath(fromId, egoId, edges);
  if (!path) return null;
  return path.filter(id => nodesById.has(id));
}
