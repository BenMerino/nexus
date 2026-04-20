import React from 'react';
import { Check } from './ui-primitives';
import { COLORS } from './relationship-types';
import type { GroupByDim } from './explorer-hull-groups';

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
  groupBy: GroupByDim;
  onGroupByChange: (dim: GroupByDim) => void;
}

const GROUP_BY_OPTIONS: { value: GroupByDim; label: string }[] = [
  { value: 'none',        label: 'None' },
  { value: 'institution', label: 'Institution' },
  { value: 'journal',     label: 'Journal' },
  { value: 'year',        label: 'Year' },
];

const LEGEND: { group: keyof NodeTypeFlags; label: string }[] = [
  { group: 'author',      label: 'Author' },
  { group: 'institution', label: 'Institution' },
  { group: 'journal',     label: 'Journal' },
  { group: 'paper',       label: 'Paper' },
];

export function GraphFiltersSidebar({ flags, setFlag, yearMin, yearMax, yearFloor, onYearFloorChange, groupBy, onGroupByChange }: Props) {
  const paperColor = '#888';
  return (
    <aside className="graph-filters">
      <div className="filter-group">
        <div className="filter-label">Node types</div>
        <Check checked={flags.author}      onChange={v => setFlag('author', v)}      label="Authors"      color={COLORS.author} />
        <Check checked={flags.institution} onChange={v => setFlag('institution', v)} label="Institutions" color={COLORS.institution} />
        <Check checked={flags.journal}     onChange={v => setFlag('journal', v)}     label="Journals"     color={COLORS.journal} />
        <Check checked={flags.paper}       onChange={v => setFlag('paper', v)}       label="Papers"       color={paperColor} />
      </div>

      <div className="filter-group">
        <div className="filter-label">Group by</div>
        <select value={groupBy} onChange={e => onGroupByChange(e.target.value as GroupByDim)}
          style={{ width: '100%', padding: '6px 8px', fontFamily: 'var(--mono)', fontSize: 12, background: 'var(--bg-card)', border: '1px solid var(--border-soft)', borderRadius: 3, color: 'var(--fg)' }}>
          {GROUP_BY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
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
        <div className="filter-label">Legend</div>
        {LEGEND.map(l => (
          <div key={l.group} className="legend-row">
            <span className="dot" style={{ background: l.group === 'paper' ? paperColor : COLORS[l.group] }} />
            {l.label}
          </div>
        ))}
      </div>

      <div className="filter-hint mono">DRAG nodes · CLICK for detail · HOVER to isolate</div>
    </aside>
  );
}
