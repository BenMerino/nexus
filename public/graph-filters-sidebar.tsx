import React, { useMemo } from 'react';
import { Check } from './ui-primitives';
import { COLORS, type EnrichedSimNode } from './relationship-types';
import type { ExplorerAffiliations } from './explorer-affiliations';
import { CommunityLegend, type CommunityAdapter } from './community-graph';
import { explorerCommunityKey } from './explorer-community';

export interface NodeTypeFlags {
  institution: boolean;
  author: boolean;
  coauthor: boolean;
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

export function GraphFiltersSidebar({ flags, setFlag, yearMin, yearMax, yearFloor, onYearFloorChange, nodes, affiliations, homeInstitutionId }: Props) {
  const paperColor = '#888';

  const labelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of nodes) if (n.group === 'institution' || n.group === 'journal') m.set(n.id, n.label);
    return m;
  }, [nodes]);

  const journalByDoi = useMemo(() => {
    const hasPapers = nodes.some(n => n.group === 'doi');
    if (!hasPapers) return null;
    const m = new Map<string, string>();
    for (const [jId, dois] of affiliations.doisByJournal) for (const d of dois) m.set(d, jId);
    return m;
  }, [nodes, affiliations.doisByJournal]);

  const legendAdapter = useMemo<CommunityAdapter<EnrichedSimNode>>(() => ({
    getId: n => n.id,
    getLabel: n => n.label,
    getRadius: () => 0,
    getCommunityKey: n => explorerCommunityKey(n, affiliations.institutionCountsByAuthor, homeInstitutionId, journalByDoi),
    isEgo: () => false,
    getCommunityLabel: key => labelById.get(key) || key,
  }), [affiliations, labelById, homeInstitutionId, journalByDoi]);

  return (
    <aside className="graph-filters">
      <div className="filter-group">
        <div className="filter-label">Node types</div>
        <Check checked={flags.author}      onChange={v => setFlag('author', v)}      label="Authors"      color={COLORS.author} />
        <Check checked={flags.coauthor}    onChange={v => setFlag('coauthor', v)}    label="Co-authors"   color={COLORS.author} />
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
