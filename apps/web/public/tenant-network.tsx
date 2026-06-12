import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CommunityGraph, type CommunityAdapter } from './community-graph';
import { ChartPanel } from './tenant-panel';
import { authorProfileHref } from './tenant-data';
import { ES } from './tenant-i18n';

/* The tenant's public collaboration network — /api/public/:slug/graph (top 80
 * researchers + 40 partner institutions, server-capped) rendered through the
 * generic CommunityGraph. Communities = each institution and the researchers
 * whose strongest tie points at it; researcher nodes click through to their
 * public profile. Tenant-wide only (the endpoint has no unit scope), so the
 * host hides this panel when a unit is selected. */

interface GNode { id: string; label: string; group: 'author' | 'institution'; ext_id: string | null; }
interface GEdge { source: string; target: string; weight: number; }
interface Graph { nodes: GNode[]; edges: GEdge[]; }

const HEIGHT = 480;

export function TenantNetwork({ slug }: { slug: string }) {
  const [graph, setGraph] = useState<Graph | null>(null);
  const [width, setWidth] = useState(0);
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/public/${encodeURIComponent(slug)}/graph`)
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(d => {
        if (cancelled || !d.graph?.nodes?.length) return;
        // Drop id-less nodes (authors without ORCID key as null upstream) and
        // any edge touching them — the sim needs stable string ids.
        const nodes: GNode[] = d.graph.nodes.filter((n: GNode) => !!n.id);
        const ids = new Set(nodes.map(n => n.id));
        const edges: GEdge[] = d.graph.edges.filter((e: GEdge) => ids.has(e.source) && ids.has(e.target));
        if (nodes.length) setGraph({ nodes, edges });
      })
      .catch(() => { /* panel simply doesn't render */ });
    return () => { cancelled = true; };
  }, [slug]);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => setWidth(Math.floor(entries[0].contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [graph]);

  // Node weight = summed edge weight (shared papers); a researcher's community
  // = the institution they share most papers with, institutions are their own.
  const { weights, homeFor, instLabel } = useMemo(() => {
    const weights = new Map<string, number>();
    const homeFor = new Map<string, string>();
    const instLabel = new Map<string, string>();
    if (graph) {
      for (const n of graph.nodes) if (n.group === 'institution') instLabel.set(n.id, n.label);
      const best = new Map<string, number>();
      for (const e of graph.edges) {
        weights.set(e.source, (weights.get(e.source) || 0) + e.weight);
        weights.set(e.target, (weights.get(e.target) || 0) + e.weight);
        const [author, inst] = instLabel.has(e.target) ? [e.source, e.target] : [e.target, e.source];
        if (!instLabel.has(inst) || instLabel.has(author)) continue;
        if (e.weight > (best.get(author) ?? -1)) { best.set(author, e.weight); homeFor.set(author, inst); }
      }
    }
    return { weights, homeFor, instLabel };
  }, [graph]);

  const adapter = useMemo<CommunityAdapter<GNode>>(() => ({
    getId: n => n.id,
    getLabel: n => n.label,
    getRadius: n => Math.min(18, (n.group === 'institution' ? 6 : 4) + Math.sqrt(weights.get(n.id) || 1)),
    getCommunityKey: n => (n.group === 'institution' ? n.id : homeFor.get(n.id) ?? null),
    isEgo: () => false,
    getHoverSubtitle: n => (n.group === 'institution' ? null : n.ext_id),
    getHoverFootnote: n => {
      const w = weights.get(n.id) || 0;
      return w ? `${w} shared ${w === 1 ? 'paper' : 'papers'}` : null;
    },
    getCommunityLabel: key => instLabel.get(key) ?? key,
    getTypeTag: n => (n.group === 'institution' ? 'INSTITUTION' : null),
  }), [weights, homeFor, instLabel]);

  if (!graph) return null;

  return (
    <div className="chart-grid" style={{ marginTop: 24 }}>
      <ChartPanel className="full" title={ES.charts.network} sub={ES.charts.networkSub}>
        <div ref={hostRef} style={{ height: HEIGHT, overflow: 'hidden' }}>
          {width > 0 && (
            <CommunityGraph<GNode, GEdge>
              nodes={graph.nodes}
              links={graph.edges}
              adapter={adapter}
              width={width}
              height={HEIGHT}
              onNodeClick={n => {
                if (n.group === 'author' && n.ext_id) window.location.href = authorProfileHref(slug, n.ext_id);
              }}
            />
          )}
        </div>
      </ChartPanel>
    </div>
  );
}
