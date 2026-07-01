import React, { useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SectionHead, Tag, Skeleton } from './ui-kit';

/* Journals entity page (authed). Venue domain from the new /api/journals:
 * one row per venue with paper/citation rollups + the four indexation flags
 * (WoS/Scopus/DOAJ/SciELO). Loading via the Skeleton primitive. */

type Journal = {
  id: number; issn: string | null; name: string; type: string;
  paperCount: number; citationCount: number;
  indexation: { wos: boolean; scopus: boolean; doaj: boolean; scielo: boolean };
};

const FLAGS: { key: keyof Journal['indexation']; label: string }[] = [
  { key: 'wos', label: 'WoS' }, { key: 'scopus', label: 'Scopus' },
  { key: 'doaj', label: 'DOAJ' }, { key: 'scielo', label: 'SciELO' },
];

function Indexation({ ix }: { ix: Journal['indexation'] }) {
  const on = FLAGS.filter(f => ix[f.key]);
  if (on.length === 0) return <span className="muted">—</span>;
  return <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>{on.map(f => <Tag key={f.key} mono>{f.label}</Tag>)}</span>;
}

function Row({ j }: { j: Journal }) {
  return (
    <tr>
      <td className="paper-title">{j.name}{j.issn && <div className="mono paper-doi">{j.issn}</div>}</td>
      <td><Indexation ix={j.indexation} /></td>
      <td>{j.paperCount.toLocaleString()}</td>
      <td>{j.citationCount.toLocaleString()}</td>
    </tr>
  );
}

function RowSkeleton() {
  return (
    <tr>
      <td className="paper-title">
        <Skeleton as="span">Revista Médica de Chile</Skeleton>
        <div className="mono paper-doi"><Skeleton as="span">0000-0000</Skeleton></div>
      </td>
      <td><Skeleton as="span">Scopus · WoS</Skeleton></td>
      <td><Skeleton as="span">00</Skeleton></td>
      <td><Skeleton as="span">000</Skeleton></td>
    </tr>
  );
}

function App() {
  const [data, setData] = useState<Journal[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/journals')
      .then(r => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((d: Journal[]) => setData(d))
      .catch(e => setErr(String(e)));
  }, []);

  return (
    <div className="view">
      <header className="view-head">
        <div><h1 className="view-title">Journals</h1></div>
        {data && <div className="view-meta"><span className="mono muted">{data.length.toLocaleString()} venues</span></div>}
      </header>
      <section className="card">
        <SectionHead eyebrow="Venue domain" title="Journals & indexation" />
        {err && <div className="status error">Error: {err}</div>}
        <table className="paper-table">
          <thead><tr><th>Journal</th><th>Indexation</th><th>Papers</th><th>Cites</th></tr></thead>
          <tbody>
            {data
              ? data.map(j => <Row key={j.id} j={j} />)
              : Array.from({ length: 8 }).map((_, i) => <RowSkeleton key={i} />)}
          </tbody>
        </table>
        {data && data.length === 0 && <div className="muted">No journals yet.</div>}
      </section>
    </div>
  );
}

let root: Root | null = null;
// Exported for the SPA page (spa/JournalsPage.tsx) to re-invoke on every
// React mount — legacy-mount.ts contract. Idempotent: unmounts the prior root
// first. Registered on __nexusMounts too, for the legacy spa-router.js path
// (still used by not-yet-migrated pages during the migration window).
export function mount() {
  const el = document.getElementById('journals-root');
  if (!el) return;
  if (root) root.unmount();
  root = createRoot(el);
  root.render(<App />);
}
