import React from 'react';
import { hIndexTooltip } from './h-index-breakdown';
import { ES } from './tenant-i18n';
import { authorProfileHref } from './tenant-data';
import type { AuthorRow as AuthorRowData } from './tenant-authors';

const num: React.CSSProperties = {
  textAlign: 'right', fontFamily: 'var(--mono)', fontVariantNumeric: 'tabular-nums',
};

// One directory row. Authors with an ORCID link to their public profile page
// (/t/:slug/a/:orcid) from both the name and an explicit Profile button;
// ORCID-less authors render plain (no dead links).
export function AuthorTableRow({ a, slug }: { a: AuthorRowData; slug: string }) {
  return (
    <tr>
      <td>{a.orcid
        ? <a href={authorProfileHref(slug, a.orcid)} style={{ color: 'var(--fg)' }} title={ES.profile.viewProfileTitle}>{a.name}</a>
        : a.name}</td>
      <td style={num}>{a.paperCount.toLocaleString()}</td>
      <td style={num} title={hIndexTooltip(a.hIndexByType)}>{a.hIndex}</td>
      <td style={num}>{a.totalCitations.toLocaleString()}</td>
      <td>{a.orcid
        ? <a href={`https://orcid.org/${a.orcid}`} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{a.orcid}</a>
        : <span className="text-muted text-small">{ES.authorsTable.none}</span>}</td>
      <td style={{ textAlign: 'right' }}>{a.orcid && (
        <a className="primary-btn" style={{ padding: '3px 10px', fontSize: 11, textDecoration: 'none' }}
           href={authorProfileHref(slug, a.orcid)} title={ES.profile.viewProfileTitle}>
          {ES.profile.viewProfile} →
        </a>
      )}</td>
    </tr>
  );
}
