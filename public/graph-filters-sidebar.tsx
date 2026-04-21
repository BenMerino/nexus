import React, { useMemo } from 'react';
import { Check } from './ui-primitives';
import { COLORS, type EnrichedSimNode } from './relationship-types';
import type { ExplorerAffiliations } from './explorer-affiliations';
import { CommunityLegend, type CommunityAdapter } from './community-graph';
import { explorerCommunityKey, type HullTier } from './explorer-community';
import { YearRangeSlider } from './year-range-slider';

/** Last-ditch label for a community key when the label map misses. Strips
 *  the group:prefix and any ROR/URL noise so at least something human lands
 *  on screen instead of the raw identifier. */
function prettyFallback(key: string): string {
  const bare = key.replace(/^[a-z]+:/, '');
  const m = bare.match(/\/([^/]+)\/?$/);
  return m ? m[1] : bare;
}

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
  yearFrom: number;
  yearTo: number;
  onYearRangeChange: (from: number, to: number) => void;
  nodes: EnrichedSimNode[];
  allNodes: { id: string; group: string; label: string }[];
  affiliations: ExplorerAffiliations;
  homeInstitutionId: string | null;
}

export function GraphFiltersSidebar({ flags, setFlag, yearMin, yearMax, yearFrom, yearTo, onYearRangeChange, nodes, allNodes, affiliations, homeInstitutionId }: Props) {
  const paperColor = '#888';

  const labelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of allNodes) if (n.group === 'institution' || n.group === 'journal') m.set(n.id, n.label);
    return m;
  }, [allNodes]);

  const journalByDoi = useMemo(() => {
    const hasPapers = nodes.some(n => n.group === 'doi');
    if (!hasPapers) return null;
    const m = new Map<string, string>();
    for (const [jId, dois] of affiliations.doisByJournal) for (const d of dois) m.set(d, jId);
    return m;
  }, [nodes, affiliations.doisByJournal]);

  const hullTier: HullTier = useMemo(() => {
    if (nodes.some(n => n.group === 'institution')) return 'institution';
    if (nodes.some(n => n.group === 'journal')) return 'journal';
    return 'none';
  }, [nodes]);

  const legendAdapter = useMemo<CommunityAdapter<EnrichedSimNode>>(() => ({
    getId: n => n.id,
    getLabel: n => n.label,
    getRadius: () => 0,
    getCommunityKey: n => explorerCommunityKey(n, affiliations.institutionCountsByAuthor, affiliations.journalCountsByAuthor, homeInstitutionId, journalByDoi, hullTier),
    isEgo: () => false,
    getCommunityLabel: key => labelById.get(key) || prettyFallback(key),
  }), [affiliations, labelById, homeInstitutionId, journalByDoi, hullTier]);

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
          <div className="filter-label">Year range</div>
          <YearRangeSlider min={yearMin} max={yearMax} from={yearFrom} to={yearTo} onChange={onYearRangeChange} />
        </div>
      )}

      {nodes.length > 0 && (
        <div className="filter-group legend">
          <div className="filter-label">Communities</div>
          <CommunityLegend nodes={nodes} adapter={legendAdapter} primaryKey={homeInstitutionId} minSize={1} />
        </div>
      )}

      <div className="filter-hint mono">DRAG nodes · CLICK for detail · HOVER to isolate</div>
    </aside>
  );
}
