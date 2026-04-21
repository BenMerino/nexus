import React, { useMemo } from 'react';
import type { EnrichedSimNode } from './relationship-types';
import { COLORS } from './relationship-types';
import type { ExplorerAffiliations } from './explorer-affiliations';
import { explorerCommunityKey } from './explorer-community';
import { OTHER_KEY, OTHER_LABEL } from './community-graph';
import type { CommunityAdapter } from './community-graph';
import { buildCommunityColors, majorCommunities, effectiveKey } from './community-graph/communities';

interface Props {
  nodes: EnrichedSimNode[];
  affiliations: ExplorerAffiliations;
  homeInstitutionId: string | null;
  egoAuthorId: string | null;
  onSelect: (id: string) => void;
}

interface Bucket {
  key: string;
  label: string;
  color: string;
  emphasis: boolean;
  institutions: EnrichedSimNode[];
  authors: EnrichedSimNode[];
  journals: EnrichedSimNode[];
  papers: EnrichedSimNode[];
}

function sortByWeightThenLabel(a: EnrichedSimNode, b: EnrichedSimNode) {
  const d = (b.weight || 0) - (a.weight || 0);
  return d !== 0 ? d : a.label.localeCompare(b.label);
}

export function GraphContents({ nodes, affiliations, homeInstitutionId, egoAuthorId, onSelect }: Props) {
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

  const adapter = useMemo<CommunityAdapter<EnrichedSimNode>>(() => ({
    getId: n => n.id,
    getLabel: n => n.label,
    getRadius: () => 0,
    getCommunityKey: n => {
      if (egoAuthorId && n.id === egoAuthorId) return homeInstitutionId;
      return explorerCommunityKey(n, affiliations.institutionCountsByAuthor, homeInstitutionId, journalByDoi);
    },
    isEgo: n => !!egoAuthorId && n.id === egoAuthorId,
    getCommunityLabel: key => labelById.get(key) || key,
  }), [affiliations, homeInstitutionId, egoAuthorId, journalByDoi, labelById]);

  const buckets = useMemo<Bucket[]>(() => {
    const minSize = 1;
    const colors = buildCommunityColors(nodes, adapter, homeInstitutionId, minSize);
    const major = majorCommunities(nodes, adapter, homeInstitutionId, minSize);
    const map = new Map<string, Bucket>();
    const ensure = (k: string) => {
      let b = map.get(k);
      if (!b) {
        b = {
          key: k,
          label: k === OTHER_KEY ? OTHER_LABEL : (labelById.get(k) || k),
          color: colors.get(k) || '#888',
          emphasis: k === homeInstitutionId,
          institutions: [], authors: [], journals: [], papers: [],
        };
        map.set(k, b);
      }
      return b;
    };
    for (const n of nodes) {
      const key = effectiveKey(n, adapter, major);
      if (!key) continue;
      const b = ensure(key);
      if (n.group === 'institution') b.institutions.push(n);
      else if (n.group === 'author') b.authors.push(n);
      else if (n.group === 'journal') b.journals.push(n);
      else if (n.group === 'doi') b.papers.push(n);
    }
    const ordered = [...map.values()];
    ordered.sort((a, b) => {
      if (a.emphasis !== b.emphasis) return a.emphasis ? -1 : 1;
      if ((a.key === OTHER_KEY) !== (b.key === OTHER_KEY)) return a.key === OTHER_KEY ? 1 : -1;
      const sizeA = a.institutions.length + a.authors.length + a.journals.length + a.papers.length;
      const sizeB = b.institutions.length + b.authors.length + b.journals.length + b.papers.length;
      return sizeB - sizeA;
    });
    for (const b of ordered) {
      b.institutions.sort(sortByWeightThenLabel);
      b.authors.sort(sortByWeightThenLabel);
      b.journals.sort(sortByWeightThenLabel);
      b.papers.sort(sortByWeightThenLabel);
    }
    return ordered;
  }, [nodes, adapter, homeInstitutionId, journalByDoi, labelById]);

  if (!nodes.length) return null;

  return (
    <div className="graph-contents">
      <div className="graph-contents-head">
        <div className="eyebrow">Graph contents</div>
        <p className="muted">Everything visible on the canvas, grouped by community. Click a row to open its detail.</p>
      </div>
      {buckets.map(b => <BucketView key={b.key} b={b} onSelect={onSelect} />)}
    </div>
  );
}

function BucketView({ b, onSelect }: { b: Bucket; onSelect: (id: string) => void }) {
  const total = b.institutions.length + b.authors.length + b.journals.length + b.papers.length;
  return (
    <section className={`gc-community${b.emphasis ? ' emphasis' : ''}`} style={{ borderColor: b.color }}>
      <header className="gc-community-head">
        <span className="gc-swatch" style={{ background: b.color }} />
        <h4>{b.label}</h4>
        <span className="mono muted gc-count">{total}</span>
      </header>
      <NodeList label="Institutions" color={COLORS.institution} ns={b.institutions} onSelect={onSelect} />
      <NodeList label="Authors"      color={COLORS.author}      ns={b.authors}      onSelect={onSelect} />
      <NodeList label="Journals"     color={COLORS.journal}     ns={b.journals}     onSelect={onSelect} />
      <NodeList label="Papers"       color="#888"               ns={b.papers}       onSelect={onSelect} />
    </section>
  );
}

function NodeList({ label, color, ns, onSelect }: { label: string; color: string; ns: EnrichedSimNode[]; onSelect: (id: string) => void }) {
  if (ns.length === 0) return null;
  return (
    <div className="gc-list">
      <div className="gc-list-label"><span className="dot" style={{ background: color }} /> {label} <span className="mono muted">{ns.length}</span></div>
      <ul>
        {ns.map(n => (
          <li key={n.id}><button type="button" onClick={() => onSelect(n.id)}>{n.label}</button></li>
        ))}
      </ul>
    </div>
  );
}
