import React from 'react';
import { Ico } from './ui-primitives';
import type { AuthorD, Paper } from './node-detail-views';
import { RichHtml } from './rich-text';

function PaperRow({ p }: { p: Paper }) {
  const year = p.published?.slice(0, 4);
  return (
    <div className="detail-item">
      <div>{p.title ? <RichHtml raw={p.title} /> : '(untitled)'}</div>
      <div className="detail-item-sub">
        <span className="mono muted">{p.doi}</span>
        <span className="mono muted detail-item-year">{year || ''}</span>
      </div>
    </div>
  );
}

function groupPapersByJournal(papers: Paper[]): { journal: string; papers: Paper[] }[] {
  const buckets = new Map<string, Paper[]>();
  for (const p of papers) {
    const k = p.journal || 'Unknown venue';
    const list = buckets.get(k) ?? [];
    list.push(p);
    buckets.set(k, list);
  }
  const groups = Array.from(buckets, ([journal, papers]) => ({ journal, papers }));
  // Most-published first; tie-break by most recent paper in the bucket.
  groups.sort((a, b) => {
    if (b.papers.length !== a.papers.length) return b.papers.length - a.papers.length;
    const ay = a.papers[0]?.published ?? '';
    const by = b.papers[0]?.published ?? '';
    return by.localeCompare(ay);
  });
  return groups;
}

export function AuthorView({ d, onClose }: { d: AuthorD; onClose: () => void }) {
  const groups = groupPapersByJournal(d.papers);
  return (
    <div className="detail">
      <div className="detail-head">
        <div>
          <div className="eyebrow">Author</div>
          <h3><RichHtml raw={d.name} /></h3>
          {d.hIndex != null && <div className="detail-hindex"><span className="mono">h-index</span> {d.hIndex}</div>}
          {d.orcid && <div className="mono detail-id">ORCID {d.orcid}</div>}
        </div>
        <button className="close" onClick={onClose} aria-label="Close">{Ico.close}</button>
      </div>
      {(d.faculty || d.role) && (
        <div className="detail-meta">
          {d.faculty && <div><span className="muted">Faculty</span><span>{d.faculty}</span></div>}
          {d.role && <div><span className="muted">Role</span><span>{d.role}</span></div>}
        </div>
      )}
      <div className="detail-stats">
        <div><span className="mono">{d.papersCount}</span><label>papers</label></div>
        <div><span className="mono">{d.citations}</span><label>citations</label></div>
        <div><span className="mono">{d.journalsCount ?? groups.length}</span><label>journals</label></div>
      </div>
      {groups.map(g => (
        <div key={g.journal} className="detail-section">
          <div className="detail-section-label">
            <RichHtml raw={g.journal} /> <span className="mono muted">{g.papers.length}</span>
          </div>
          {g.papers.map(p => <PaperRow key={p.doi} p={p} />)}
        </div>
      ))}
    </div>
  );
}
