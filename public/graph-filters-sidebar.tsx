import React, { useMemo } from 'react';
import { Check } from './ui-primitives';
import { COLORS, type EnrichedSimNode } from './relationship-types';
import type { ExplorerAffiliations } from './explorer-affiliations';
import { CommunityLegend, type CommunityAdapter } from './community-graph';

export interface NodeTypeFlags {
  institution: boolean;
  author: boolean;
  journal: boolean;
  paper: boolean;
}

interface Props {
  flags: NodeTypeFlags;
  setFlag: (k: keyof NodeTypeFlags, v: boolean) => void;
  yearMin: number;
  yearMax: number;
  yearFloor: number;
  onYearFloorChange: (y: number) => void;
  nodes: EnrichedSimNode[];
  affiliations: ExplorerAffiliations;
  homeInstitutionId: string | null;
}

const LEGEND: { group: keyof NodeTypeFlags; label: string }[] = [
  { group: 'author',      label: 'Author' },
  { group: 'institution', label: 'Institution' },
  { group: 'journal',     label: 'Journal' },
  { group: 'paper',       label: 'Paper' },
];

function pickCommunityKey(n: EnrichedSimNode, institutionsByAuthor: Map<string, Set<string>>): string | null {
  if (n.group === 'institution') return n.id;
  if (n.group === 'author') {
    const insts = institutionsByAuthor.get(n.id);
    if (!insts || insts.size === 0) return null;
    return [...insts].sort()[0];
  }
  return null;
}

export function GraphFiltersSidebar({ flags, setFlag, yearMin, yearMax, yearFloor, onYearFloorChange, nodes, affiliations, homeInstitutionId }: Props) {
  const paperColor = '#888';

  const institutionLabelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of nodes) if (n.group === 'institution') m.set(n.id, n.label);
    return m;
  }, [nodes]);

  const legendAdapter = useMemo<CommunityAdapter<EnrichedSimNode>>(() => ({
    getId: n => n.id,
    getLabel: n => n.label,
    getRadius: () => 0,
    getCommunityKey: n => pickCommunityKey(n, affiliations.institutionsByAuthor),
    isEgo: () => false,
    getCommunityLabel: key => institutionLabelById.get(key) || key,
  }), [affiliations, institutionLabelById]);

  return (
    <aside className="graph-filters">
      <div className="filter-group">
        <div className="filter-label">Node types</div>
        <Check checked={flags.author}      onChange={v => setFlag('author', v)}      label="Authors"      color={COLORS.author} />
        <Check checked={flags.institution} onChange={v => setFlag('institution', v)} label="Institutions" color={COLORS.institution} />
        <Check checked={flags.journal}     onChange={v => setFlag('journal', v)}     label="Journals"     color={COLORS.journal} />
        <Check checked={flags.paper}       onChange={v => setFlag('paper', v)}       label="Papers"       color={paperColor} />
      </div>

      {yearMax > yearMin && (
        <div className="filter-group">
          <div className="filter-label">Year floor</div>
          <div className="year-slider">
            <input type="range" min={yearMin} max={yearMax} value={yearFloor}
              onChange={e => onYearFloorChange(parseInt(e.target.value))} />
            <div className="year-val mono">≥ {yearFloor}</div>
          </div>
        </div>
      )}

      <div className="filter-group legend">
        <div className="filter-label">Node types</div>
        {LEGEND.map(l => (
          <div key={l.group} className="legend-row">
            <span className="dot" style={{ background: l.group === 'paper' ? paperColor : COLORS[l.group] }} />
            {l.label}
          </div>
        ))}
      </div>

      {nodes.length > 0 && (
        <div className="filter-group legend">
          <div className="filter-label">Communities</div>
          <CommunityLegend nodes={nodes} adapter={legendAdapter} primaryKey={homeInstitutionId} />
        </div>
      )}

      <div className="filter-hint mono">DRAG nodes · CLICK for detail · HOVER to isolate</div>
    </aside>
  );
}
