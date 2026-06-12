import React from 'react';
import { ES, typeLabelEs } from './tenant-i18n';
import { RichHtml } from './rich-text';
import { authorProfileHref } from './tenant-data';
import type { ProfilePaper, PaperAuthor } from './author-profile';

const UNDATED = 'Undated';
const MAX_AUTHOR_CHIPS = 12;

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

// Full author list under each paper — roster members link to their own public
// profile (external co-authors stay plain text: no dead links).
function AuthorsLine({ authors, total, slug }: { authors?: PaperAuthor[]; total?: number; slug?: string }) {
  if (!authors?.length) return null;
  const shown = authors.slice(0, MAX_AUTHOR_CHIPS);
  const extra = Math.max(total ?? authors.length, authors.length) - shown.length;
  return (
    <div className="pub-authors">
      {shown.map((a, i) => (
        <React.Fragment key={a.orcid || `i${i}`}>
          {i > 0 && ', '}
          {a.inRoster && a.orcid && slug
            ? <a href={authorProfileHref(slug, a.orcid)}><RichHtml raw={a.name} /></a>
            : <RichHtml raw={a.name} />}
        </React.Fragment>
      ))}
      {extra > 0 && <span className="pub-authors-more"> {ES.profile.andMore(extra)}</span>}
    </div>
  );
}

function PubRow({ p, slug }: { p: ProfilePaper; slug?: string }) {
  return (
    <div className="pub-item">
      <div className="pub-title">{p.title ? <RichHtml raw={p.title} /> : '(untitled)'}</div>
      <AuthorsLine authors={p.authors} total={p.authorsTotal} slug={slug} />
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

export function AuthorPubs({ papers, open, onToggle, slug }: {
  papers: ProfilePaper[]; open: Set<string>; onToggle: (year: string) => void; slug?: string;
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
            {isOpen && g.papers.map((p, i) => <PubRow key={p.doi || `${g.year}-${i}`} p={p} slug={slug} />)}
          </div>
        );
      })}
    </div>
  );
}

// The researcher's citation leaders — a compact aside strip (top 5 by count).
export function TopCitedStrip({ papers }: { papers: ProfilePaper[] }) {
  const top = papers.filter(p => p.citations > 0)
    .sort((a, b) => b.citations - a.citations).slice(0, 5);
  if (!top.length) return null;
  return (
    <div className="topcited">
      <h2 className="profile-panel-title">{ES.profile.mostCited}</h2>
      {top.map((p, i) => (
        <div key={p.doi || i} className="topcited-row">
          <span className="topcited-title">
            {p.doi
              ? <a href={`https://doi.org/${p.doi}`} target="_blank" rel="noopener noreferrer"><RichHtml raw={p.title || '(untitled)'} /></a>
              : <RichHtml raw={p.title || '(untitled)'} />}
          </span>
          <span className="topcited-cites">{p.citations.toLocaleString()}</span>
        </div>
      ))}
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
