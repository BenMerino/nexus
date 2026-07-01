import React, { useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SectionHead, Skeleton, Tag } from './ui-kit';
import { TYPE_DISPLAY_LABELS } from './type-labels';

/* Papers entity page (authed). The publication catalog from /api/records
 * (paginated, scoped). Self-contained list; loading via the Skeleton primitive.
 * Supersedes explore.html's Records tab. */

type Paper = {
  id: number; title: string | null; doi: string; journal: string | null;
  type: string | null; published: string | null; citation_count: number | null;
};

function Row({ p }: { p: Paper }) {
  return (
    <tr>
      <td className="paper-title">{p.title || '(untitled)'}<div className="mono paper-doi">{p.doi}</div></td>
      <td>{p.type ? <Tag tone="type" mono>{TYPE_DISPLAY_LABELS[p.type] || p.type}</Tag> : '—'}</td>
      <td>{p.journal || '—'}</td>
      <td>{p.published?.slice(0, 4) || '—'}</td>
      <td>{p.citation_count ?? 0}</td>
    </tr>
  );
}

function RowSkeleton() {
  return (
    <tr>
      <td className="paper-title">
        <Skeleton as="span">A representative publication title for layout</Skeleton>
        <div className="mono paper-doi"><Skeleton as="span">10.0000/example.0000</Skeleton></div>
      </td>
      <td><Skeleton as="span" className="tag type mono">Article</Skeleton></td>
      <td><Skeleton as="span">Revista Médica de Chile</Skeleton></td>
      <td><Skeleton as="span">2024</Skeleton></td>
      <td><Skeleton as="span">000</Skeleton></td>
    </tr>
  );
}

function App() {
  const [data, setData] = useState<Paper[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/records?paginated=1&limit=50')
      .then(r => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((d: { data: Paper[]; pagination: { total: number } }) => { setData(d.data); setTotal(d.pagination?.total ?? null); })
      .catch(e => setErr(String(e)));
  }, []);

  return (
    <div className="view">
      <header className="view-head">
        <div><h1 className="view-title">Papers</h1></div>
        {total != null && <div className="view-meta"><span className="mono muted">{total.toLocaleString()} indexed</span></div>}
      </header>
      <section className="card">
        <SectionHead eyebrow="Publication domain" title="Catalog" />
        {err && <div className="status error">Error: {err}</div>}
        <table className="paper-table">
          <thead><tr><th>Title</th><th>Type</th><th>Journal</th><th>Published</th><th>Cites</th></tr></thead>
          <tbody>
            {data
              ? data.map(p => <Row key={p.id} p={p} />)
              : Array.from({ length: 10 }).map((_, i) => <RowSkeleton key={i} />)}
          </tbody>
        </table>
        {data && data.length === 0 && <div className="muted">No publications yet.</div>}
      </section>
    </div>
  );
}

let root: Root | null = null;
// Exported for the SPA page (spa/PapersPage.tsx) to re-invoke on every React
// mount — legacy-mount.ts contract. Idempotent: unmounts the prior root first.
// Registered on __nexusMounts too, for the legacy spa-router.js path (still used
// by not-yet-migrated pages during the migration window).
export function mount() {
  const el = document.getElementById('papers-root');
  if (!el) return;
  if (root) root.unmount();
  root = createRoot(el);
  root.render(<App />);
}
