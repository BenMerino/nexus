import React from 'react';
import { Ico } from './ui-primitives';

export interface Paper { doi: string; title: string | null; published: string | null; citation_count: number | null; journal?: string | null }

export interface AuthorD   { type: 'author';      name: string; orcid: string | null; faculty?: string | null; role?: string | null; papersCount: number; citations: number; hIndex?: number; papers: Paper[] }
export interface InstD     { type: 'institution'; name: string; ror: string | null; papersCount: number; papers: Paper[] }
export interface JournalD  { type: 'journal';     name: string; issn: string | null; papersCount: number; papers: Paper[] }
export interface PaperD    { type: 'paper';       doi: string; title: string | null; published: string | null; citations: number | null; journal: string | null; authors: { name?: string; orcid?: string }[] }
export type Detail = AuthorD | InstD | JournalD | PaperD;

function PaperRow({ p }: { p: Paper }) {
  const year = p.published?.slice(0, 4);
  return (
    <div className="detail-item">
      <div>{p.title || '(untitled)'}</div>
      <div className="mono muted">{p.doi}{year ? ` · ${year}` : ''}</div>
    </div>
  );
}

const CloseBtn = ({ onClose }: { onClose: () => void }) =>
  <button className="close" onClick={onClose} aria-label="Close">{Ico.close}</button>;

export function AuthorView({ d, onClose }: { d: AuthorD; onClose: () => void }) {
  return (
    <div className="detail">
      <div className="detail-head">
        <div>
          <div className="eyebrow">Author</div>
          <h3>{d.name}</h3>
          {d.orcid && <div className="mono detail-id">ORCID {d.orcid}</div>}
        </div>
        <CloseBtn onClose={onClose} />
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
        <div><span className="mono">{d.hIndex ?? 0}</span><label>h-index</label></div>
      </div>
      <div className="detail-section">
        <div className="detail-section-label">Recent papers</div>
        {d.papers.slice(0, 6).map(p => <PaperRow key={p.doi} p={p} />)}
      </div>
    </div>
  );
}

export function InstitutionView({ d, onClose }: { d: InstD; onClose: () => void }) {
  return (
    <div className="detail">
      <div className="detail-head">
        <div><div className="eyebrow">Institution</div><h3>{d.name}</h3>{d.ror && <div className="mono detail-id">ROR {d.ror}</div>}</div>
        <CloseBtn onClose={onClose} />
      </div>
      <div className="detail-meta"><div><span className="muted">Shared papers</span><span>{d.papersCount}</span></div></div>
      <div className="detail-section">
        <div className="detail-section-label">Joint publications</div>
        {d.papers.map(p => <PaperRow key={p.doi} p={p} />)}
      </div>
    </div>
  );
}

export function JournalView({ d, onClose }: { d: JournalD; onClose: () => void }) {
  return (
    <div className="detail">
      <div className="detail-head">
        <div><div className="eyebrow">Journal</div><h3>{d.name}</h3>{d.issn && <div className="mono detail-id">ISSN-L {d.issn}</div>}</div>
        <CloseBtn onClose={onClose} />
      </div>
      <div className="detail-meta"><div><span className="muted">Our papers</span><span>{d.papersCount}</span></div></div>
      <div className="detail-section">
        <div className="detail-section-label">Published here</div>
        {d.papers.map(p => <PaperRow key={p.doi} p={p} />)}
      </div>
    </div>
  );
}

export function PaperView({ d, onClose }: { d: PaperD; onClose: () => void }) {
  return (
    <div className="detail">
      <div className="detail-head">
        <div>
          <div className="eyebrow">Paper</div>
          <h3 className="paper-detail-title">{d.title || '(untitled)'}</h3>
          <div className="mono detail-id">DOI {d.doi}</div>
        </div>
        <CloseBtn onClose={onClose} />
      </div>
      <div className="detail-meta">
        {d.journal && <div><span className="muted">Journal</span><span>{d.journal}</span></div>}
        {d.published && <div><span className="muted">Year</span><span>{d.published.slice(0, 4)}</span></div>}
        {d.citations != null && <div><span className="muted">Citations</span><span>{d.citations}</span></div>}
      </div>
      {d.authors.length > 0 && (
        <div className="detail-section">
          <div className="detail-section-label">Authors</div>
          {d.authors.slice(0, 20).map((a, i) => (
            <div key={i} className="detail-item">
              <div>{a.name || a.orcid || '—'}</div>
              {a.orcid && <div className="mono muted">ORCID {a.orcid}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function EmptyState() {
  return (
    <div className="detail-empty">
      <div className="detail-empty-glyph">◎</div>
      <div className="detail-empty-head">Select a node</div>
      <p>Every node carries a canonical identifier — <span className="mono">ORCID</span> for authors, <span className="mono">ROR</span> for institutions, <span className="mono">ISSN-L</span> for journals, <span className="mono">DOI</span> for papers.</p>
      <p>No canonical ID, no tag. That&rsquo;s how the graph stays clean.</p>
    </div>
  );
}
