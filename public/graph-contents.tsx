import React, { useCallback, useMemo, useRef } from 'react';
import type { EnrichedSimNode } from './relationship-types';
import { COLORS } from './relationship-types';
import type { ExplorerAffiliations } from './explorer-affiliations';
import { explorerCommunityKey, type HullTier } from './explorer-community';
import type { CommunityAdapter } from './community-graph';
import { buildBuckets, type Bucket } from './graph-contents-buckets';
import { useFlipReorder } from './use-flip-reorder';
import { prefetchNodeDetail } from './node-detail';
import { GraphSearch } from './graph-search';

interface Props {
  nodes: EnrichedSimNode[];
  affiliations: ExplorerAffiliations;
  homeInstitutionId: string | null;
  egoAuthorId: string | null;
  onSelect: (id: string) => void;
  onHover?: (id: string | null) => void;
  hoveredId?: string | null;
  hoveredHullKey?: string | null;
  onSearchSelect?: (id: string) => void;
}

export function GraphContents({ nodes, affiliations, homeInstitutionId, egoAuthorId, onSelect, onHover, hoveredId, hoveredHullKey, onSearchSelect }: Props) {
  const journalByDoi = useMemo(() => {
    const hasPapers = nodes.some(n => n.group === 'doi');
    if (!hasPapers) return null;
    const m = new Map<string, string>();
    for (const [jId, dois] of affiliations.doisByJournal) for (const d of dois) m.set(d, jId);
    return m;
  }, [nodes, affiliations.doisByJournal]);

  const labelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of nodes) if (n.group === 'institution' || n.group === 'journal') m.set(n.id, n.label);
    return m;
  }, [nodes]);

  const hullTier: HullTier = useMemo(() => {
    if (nodes.some(n => n.group === 'institution')) return 'institution';
    if (nodes.some(n => n.group === 'journal')) return 'journal';
    return 'none';
  }, [nodes]);

  const adapter = useMemo<CommunityAdapter<EnrichedSimNode>>(() => ({
    getId: n => n.id,
    getLabel: n => n.label,
    getRadius: () => 0,
    getCommunityKey: n => {
      if (hullTier === 'institution' && egoAuthorId && n.id === egoAuthorId) return homeInstitutionId;
      return explorerCommunityKey(n, affiliations.institutionCountsByAuthor, affiliations.journalCountsByAuthor, homeInstitutionId, journalByDoi, hullTier);
    },
    isEgo: n => !!egoAuthorId && n.id === egoAuthorId,
    getCommunityLabel: key => labelById.get(key) || key,
  }), [affiliations, homeInstitutionId, egoAuthorId, journalByDoi, labelById, hullTier]);

  const focusKey = useMemo(() => {
    if (hoveredId) {
      const hovered = nodes.find(n => n.id === hoveredId);
      if (hovered) return adapter.getCommunityKey(hovered);
    }
    return hoveredHullKey ?? null;
  }, [hoveredId, hoveredHullKey, nodes, adapter]);

  const buckets = useMemo(() => buildBuckets(nodes, adapter, homeInstitutionId, labelById, focusKey),
    [nodes, adapter, homeInstitutionId, labelById, focusKey]);

  const listRef = useRef<HTMLDivElement>(null);
  useFlipReorder(listRef, buckets.map(b => b.key));

  // Debounced prefetch on hover. Fires ~120ms after the cursor settles on a
  // row so sweeping across the list doesn't burn a request per node. By the
  // time the user actually clicks, the detail is usually cached and the
  // filmstrip slide reveals a fully-populated pane instead of a blank one.
  const prefetchTimer = useRef<number | null>(null);
  const onRowHover = useCallback((id: string | null) => {
    onHover?.(id);
    if (prefetchTimer.current) { clearTimeout(prefetchTimer.current); prefetchTimer.current = null; }
    if (id) prefetchTimer.current = window.setTimeout(() => prefetchNodeDetail(id), 120);
  }, [onHover]);

  if (!nodes.length) return null;

  return (
    <div className="graph-contents">
      <div className="graph-contents-head">
        <div className="eyebrow">Graph contents</div>
        <div className="graph-contents-search">
          <GraphSearch nodes={nodes} onSelect={id => (onSearchSelect || onSelect)(id)} />
        </div>
      </div>
      <div ref={listRef} className="graph-contents-list">
        {buckets.map(b => <BucketView key={b.key} b={b} onSelect={onSelect} onHover={onRowHover} />)}
      </div>
    </div>
  );
}

function BucketView({ b, onSelect, onHover }: { b: Bucket; onSelect: (id: string) => void; onHover?: (id: string | null) => void }) {
  const total = b.authors.length + b.journals.length + b.papers.length;
  if (total === 0 && b.institutions.length === 0) return null;
  const headInstId = b.institutions[0]?.id;
  return (
    <section data-flip-key={b.key} className={`gc-community${b.emphasis ? ' emphasis' : ''}`} style={{ borderColor: b.color }}>
      <header className="gc-community-head">
        <span className="gc-swatch" style={{ background: b.color }} />
        <button type="button" className="gc-community-title"
          onClick={() => headInstId && onSelect(headInstId)}
          onMouseEnter={() => headInstId && onHover?.(headInstId)}
          onMouseLeave={() => onHover?.(null)}>
          <h4>{b.label}</h4>
        </button>
        <span className="mono muted gc-count">{total}</span>
      </header>
      <NodeList label="Authors"  color={COLORS.author}  ns={b.authors}  onSelect={onSelect} onHover={onHover} />
      <NodeList label="Journals" color={COLORS.journal} ns={b.journals} onSelect={onSelect} onHover={onHover} />
      <NodeList label="Papers"   color="#888"           ns={b.papers}   onSelect={onSelect} onHover={onHover} />
    </section>
  );
}

const ORCID_RE = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;
function displayLabel(n: EnrichedSimNode): string {
  if (n.group === 'author' && (!n.label || ORCID_RE.test(n.label))) return 'Unknown author';
  return n.label;
}

function NodeList({ label, color, ns, onSelect, onHover }: { label: string; color: string; ns: EnrichedSimNode[]; onSelect: (id: string) => void; onHover?: (id: string | null) => void }) {
  if (ns.length === 0) return null;
  return (
    <div className="gc-list">
      <div className="gc-list-label"><span className="dot" style={{ background: color }} /> {label} <span className="mono muted">{ns.length}</span></div>
      <ul>
        {ns.map(n => (
          <li key={n.id}>
            <button type="button"
              onClick={() => onSelect(n.id)}
              onMouseEnter={() => onHover?.(n.id)}
              onMouseLeave={() => onHover?.(null)}>{displayLabel(n)}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
