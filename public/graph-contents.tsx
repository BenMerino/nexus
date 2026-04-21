import React, { useMemo } from 'react';
import type { EnrichedSimNode } from './relationship-types';
import { COLORS } from './relationship-types';
import type { ExplorerAffiliations } from './explorer-affiliations';
import { explorerCommunityKey, type HullTier } from './explorer-community';
import type { CommunityAdapter } from './community-graph';
import { buildBuckets, type Bucket } from './graph-contents-buckets';

interface Props {
  nodes: EnrichedSimNode[];
  affiliations: ExplorerAffiliations;
  homeInstitutionId: string | null;
  egoAuthorId: string | null;
  onSelect: (id: string) => void;
  onHover?: (id: string | null) => void;
  hoveredId?: string | null;
}

export function GraphContents({ nodes, affiliations, homeInstitutionId, egoAuthorId, onSelect, onHover, hoveredId }: Props) {
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
    if (!hoveredId) return null;
    const hovered = nodes.find(n => n.id === hoveredId);
    return hovered ? adapter.getCommunityKey(hovered) : null;
  }, [hoveredId, nodes, adapter]);

  const buckets = useMemo(() => buildBuckets(nodes, adapter, homeInstitutionId, labelById, focusKey),
    [nodes, adapter, homeInstitutionId, labelById, focusKey]);

  if (!nodes.length) return null;

  return (
    <div className="graph-contents">
      <div className="graph-contents-head">
        <div className="eyebrow">Graph contents</div>
        <p className="muted">Everything visible on the canvas, grouped by community. Click a row to open its detail.</p>
      </div>
      {buckets.map(b => <BucketView key={b.key} b={b} onSelect={onSelect} onHover={onHover} />)}
    </div>
  );
}

function BucketView({ b, onSelect, onHover }: { b: Bucket; onSelect: (id: string) => void; onHover?: (id: string | null) => void }) {
  const total = b.authors.length + b.journals.length + b.papers.length;
  if (total === 0 && b.institutions.length === 0) return null;
  const headInstId = b.institutions[0]?.id;
  return (
    <section className={`gc-community${b.emphasis ? ' emphasis' : ''}`} style={{ borderColor: b.color }}>
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
              onMouseLeave={() => onHover?.(null)}>{n.label}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
