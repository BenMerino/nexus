import React, { useEffect, useState } from 'react';
import { SectionHead, Tag, Skeleton } from './ui-kit';

/* Public Journals view (slug-scoped, no auth). Venue domain from
 * /api/public/:slug/journals: one row per venue + indexation flags. Reused as
 * the `journals` entity in the public tenant shell. Type via tokens (N3-type),
 * loading via the Skeleton primitive. */

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

export function TenantJournals({ slug }: { slug: string }) {
  const [data, setData] = useState<Journal[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/public/${encodeURIComponent(slug)}/journals`)
      .then(r => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((d: { journals: Journal[] }) => { if (!cancelled) setData(d.journals); })
      .catch(e => { if (!cancelled) setErr(String(e)); });
    return () => { cancelled = true; };
  }, [slug]);

  return (
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
  );
}
