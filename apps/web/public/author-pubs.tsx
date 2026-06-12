import React from 'react';
import { typeLabelEs } from './tenant-i18n';
import { RichHtml } from './rich-text';
import type { ProfilePaper } from './author-profile';

const UNDATED = 'Undated';

function groupByYear(papers: ProfilePaper[]): { year: string; papers: ProfilePaper[] }[] {
  const buckets = new Map<string, ProfilePaper[]>();
  for (const p of papers) {
    const k = p.year || UNDATED;
    (buckets.get(k) ?? buckets.set(k, []).get(k)!).push(p);
  }
  // Newest first; "Undated" sinks to the bottom.
  return Array.from(buckets, ([year, papers]) => ({ year, papers }))
    .sort((a, b) => (a.year === UNDATED ? 1 : b.year === UNDATED ? -1 : b.year.localeCompare(a.year)));
}

function PubRow({ p }: { p: ProfilePaper }) {
  return (
    <div className="pub-item">
      <div className="pub-title">{p.title ? <RichHtml raw={p.title} /> : '(untitled)'}</div>
      <div className="pub-meta">
        {p.journal && <span className="pub-journal"><RichHtml raw={p.journal} /></span>}
        {p.type && <span>{typeLabelEs(p.type)}</span>}
        {p.doi && (
          <a href={`https://doi.org/${p.doi}`} target="_blank" rel="noopener noreferrer">{p.doi}</a>
        )}
        <span className="pub-cites">{p.citations.toLocaleString()} cit.</span>
      </div>
    </div>
  );
}

/** Distinct years, newest first — the order AuthorPubs renders. Used by the
 *  host to seed which groups start expanded. */
export function pubYears(papers: ProfilePaper[]): string[] {
  return groupByYear(papers).map(g => g.year);
}

export function AuthorPubs({ papers, open, onToggle }: {
  papers: ProfilePaper[]; open: Set<string>; onToggle: (year: string) => void;
}) {
  const groups = groupByYear(papers);
  return (
    <div>
      {groups.map(g => {
        const isOpen = open.has(g.year);
        return (
          <div key={g.year} className="pub-year" id={`pub-y-${g.year}`}>
            <div className="pub-year-label clickable" onClick={() => onToggle(g.year)}>
              <span><i className={`pub-twist${isOpen ? ' open' : ''}`}>▸</i> {g.year}</span>
              <span>{g.papers.length}</span>
            </div>
            {isOpen && g.papers.map((p, i) => <PubRow key={p.doi || `${g.year}-${i}`} p={p} />)}
          </div>
        );
      })}
    </div>
  );
}

// Token-colored CSS bars (no chart engine): one row per year, newest first,
// width proportional to the busiest year. Each bar is navigation, not just
// decoration: clicking expands + scrolls to that year's publication group.
export function OutputPerYear({ papers, onYearClick }: { papers: ProfilePaper[]; onYearClick?: (year: string) => void }) {
  const counts = new Map<string, number>();
  for (const p of papers) {
    if (!p.year) continue;
    counts.set(p.year, (counts.get(p.year) || 0) + 1);
  }
  const rows = Array.from(counts, ([year, n]) => ({ year, n }))
    .sort((a, b) => b.year.localeCompare(a.year));
  const max = rows.reduce((m, r) => Math.max(m, r.n), 1);
  if (!rows.length) return null;
  return (
    <div>
      {rows.map(r => (
        <div key={r.year} className={`yearbar${onYearClick ? ' clickable' : ''}`}
             onClick={onYearClick ? () => onYearClick(r.year) : undefined}>
          <span className="y">{r.year}</span>
          <span className="t"><i style={{ width: `${Math.round((r.n / max) * 100)}%` }} /></span>
          <span className="n">{r.n}</span>
        </div>
      ))}
    </div>
  );
}
