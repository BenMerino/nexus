import React, { useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SectionHead, Skeleton } from './ui-kit';

/* Academics entity page (authed). Lists the tenant's researchers (author
 * domain) from /api/search-academics; each row links to the public author
 * profile. Self-contained (the public-tenant author components are slug-scoped,
 * not reusable here). Loading state uses the Skeleton primitive. */

type Academic = { name: string; orcid: string | null; position: string | null; faculty: string | null; grade: string | null };

function Row({ a }: { a: Academic }) {
  return (
    <tr>
      <td className="paper-title">
        {a.name}
        {a.orcid && <div className="mono paper-doi">{a.orcid}</div>}
      </td>
      <td>{a.position || '—'}</td>
      <td>{a.faculty || '—'}</td>
      <td>{a.grade || '—'}</td>
    </tr>
  );
}

function RowSkeleton() {
  return (
    <tr>
      <td className="paper-title">
        <Skeleton as="span">Researcher placeholder name</Skeleton>
        <div className="mono paper-doi"><Skeleton as="span">0000-0000-0000-0000</Skeleton></div>
      </td>
      <td><Skeleton as="span">Professor</Skeleton></td>
      <td><Skeleton as="span">Faculty of Sciences</Skeleton></td>
      <td><Skeleton as="span">PhD</Skeleton></td>
    </tr>
  );
}

function App() {
  const [data, setData] = useState<Academic[] | null>(null);
  const [q, setQ] = useState('');
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    const url = q.trim() ? `/api/search-academics?q=${encodeURIComponent(q.trim())}` : '/api/search-academics';
    fetch(url)
      .then(r => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((d: Academic[]) => setData(d))
      .catch(e => setErr(String(e)));
  }, [q]);

  return (
    <div className="view">
      <header className="view-head">
        <div><h1 className="view-title">Academics</h1></div>
        <input className="sidebar-search-input" style={{ maxWidth: 280 }}
          placeholder="Search researchers…" value={q} onChange={e => setQ(e.target.value)} />
      </header>
      <section className="card">
        <SectionHead eyebrow="Author domain" title="Researchers" />
        {err && <div className="status error">Error: {err}</div>}
        <table className="paper-table">
          <thead><tr><th>Name</th><th>Position</th><th>Faculty</th><th>Grade</th></tr></thead>
          <tbody>
            {data
              ? data.map((a, i) => <Row key={a.orcid || i} a={a} />)
              : Array.from({ length: 8 }).map((_, i) => <RowSkeleton key={i} />)}
          </tbody>
        </table>
        {data && data.length === 0 && <div className="muted">No researchers found.</div>}
      </section>
    </div>
  );
}

let root: Root | null = null;
// Exported for the SPA page (spa/AcademicsPage.tsx) to re-invoke on every
// React mount — legacy-mount.ts contract. Idempotent: unmounts the prior root
// first. Registered on __nexusMounts too, for the legacy spa-router.js path
// (still used by not-yet-migrated pages during the migration window).
export function mount() {
  const el = document.getElementById('academics-root');
  if (!el) return;
  if (root) root.unmount();
  root = createRoot(el);
  root.render(<App />);
}
