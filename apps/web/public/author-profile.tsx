import React from 'react';
import { ES, typeLabelEs } from './tenant-i18n';
import { RichHtml } from './rich-text';
import { AuthorPubs, OutputPerYear } from './author-pubs';

export interface ProfilePaper {
  title: string | null;
  doi: string | null;
  year: string | null;
  journal: string | null;
  type: string | null;
  citations: number;
}

export interface AuthorProfileData {
  name: string;
  orcid: string;
  roster: { faculty: string | null; department: string | null; category: string | null; unitKey: string | null } | null;
  paperCount: number;
  totalCitations: number;
  hIndex: number;
  hIndexByType: Record<string, number>;
  papers: ProfilePaper[];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '·';
  const first = parts[0][0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] || '' : '';
  return (first + last).toUpperCase();
}

function activeYearsLabel(papers: ProfilePaper[]): string | null {
  const years = papers.map(p => p.year).filter(Boolean) as string[];
  if (!years.length) return null;
  const min = years.reduce((a, b) => (a < b ? a : b));
  const max = years.reduce((a, b) => (a > b ? a : b));
  return min === max ? min : `${min}–${max}`;
}

export function AuthorProfile({ d }: { d: AuthorProfileData }) {
  const years = activeYearsLabel(d.papers);
  // h-index chips by document type, biggest first — only types with signal.
  const typeChips = Object.entries(d.hIndexByType)
    .filter(([, h]) => h > 0)
    .sort((a, b) => b[1] - a[1]);

  return (
    <>
      <section className="profile-hero">
        <div className="profile-head">
          <div className="profile-avatar" aria-hidden="true"><span>{initials(d.name)}</span></div>
          <div className="profile-id">
            <div className="profile-eyebrow">{ES.profile.eyebrow}</div>
            <h1 className="profile-name"><RichHtml raw={d.name} /></h1>
            <div className="profile-unit">
              {d.roster
                ? <>
                    {d.roster.department && <><b>{d.roster.department}</b>{' · '}</>}
                    {d.roster.faculty || ES.profile.unfiled}
                  </>
                : ES.profile.unfiled}
            </div>
            <div className="profile-chips">
              {d.roster?.category && <span className="profile-chip">{d.roster.category}</span>}
              <a className="profile-chip orcid" href={`https://orcid.org/${d.orcid}`}
                 target="_blank" rel="noopener noreferrer">
                {ES.profile.onOrcid} {d.orcid}
              </a>
            </div>
          </div>
        </div>
        <div className="profile-stats">
          <div className="profile-stat"><span>{d.paperCount.toLocaleString()}</span><label>{ES.profile.papers}</label></div>
          <div className="profile-stat"><span>{d.totalCitations.toLocaleString()}</span><label>{ES.profile.citations}</label></div>
          <div className="profile-stat"><span>{d.hIndex}</span><label>{ES.profile.hIndex}</label></div>
          {years && <div className="profile-stat"><span>{years}</span><label>{ES.profile.activeYears}</label></div>}
        </div>
        {typeChips.length > 1 && (
          <div className="profile-chips" style={{ marginTop: 14 }}>
            {typeChips.map(([type, h]) => (
              <span key={type} className="profile-chip">{typeLabelEs(type)} · h {h}</span>
            ))}
          </div>
        )}
      </section>
      <div className="profile-grid">
        <section className="profile-panel">
          <h2 className="profile-panel-title">{ES.profile.publications}</h2>
          <AuthorPubs papers={d.papers} />
        </section>
        <aside className="profile-panel">
          <h2 className="profile-panel-title">{ES.profile.outputPerYear}</h2>
          <OutputPerYear papers={d.papers} />
        </aside>
      </div>
    </>
  );
}
