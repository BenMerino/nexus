import React, { useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SectionHead, Stat, Skeleton } from './ui-kit';

/* Faculties entity page (authed). The institution domain's org tree from
 * /api/claustro?action=list: totals row + faculty → department → headcount
 * tree. Read-only. Loading via Stat.Skeleton + the Skeleton primitive.
 * Supersedes org-scheme.html's org-chart tab. */

type Person = { name: string; orcid?: string | null; category?: string; paperCount?: number };
type Dept = { name: string; headcount: number; withOrcid: number; papers: number; people: Person[] };
type Faculty = { name: string; kind?: string; headcount: number; withOrcid: number; papers: number; departments: Dept[] };
type OrgTree = {
  totals: { faculties: number; institutes: number; headcount: number; withOrcid: number; papers: number };
  faculties: Faculty[];
};

const KIND_LABEL: Record<string, string> = { faculty: 'Faculty', institute: 'Institute', other: 'Other' };

function FacultyNode({ f }: { f: Faculty }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="org-node">
      <div className="org-row" onClick={() => setOpen(o => !o)} style={{ cursor: 'pointer' }}>
        <span className="org-twist">{open ? '▼' : '▶'}</span>
        <span className="org-name fac">{f.name}{f.kind && <span className="org-kind"> {KIND_LABEL[f.kind] || ''}</span>}</span>
        <span className="org-metrics">
          <span className="org-pill">{f.headcount} people</span>
          <span className="org-pill">{f.papers} papers</span>
        </span>
      </div>
      {open && (
        <div className="org-children open">
          {f.departments.map((d, i) => (
            <div key={i} className="org-row" style={{ paddingLeft: 24 }}>
              <span className="org-name dep">{d.name}</span>
              <span className="org-metrics">
                <span className="org-pill">{d.headcount} people</span>
                <span className="org-pill">{d.papers} papers</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function App() {
  const [data, setData] = useState<OrgTree | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/claustro?action=list')
      .then(r => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((d: OrgTree) => setData(d))
      .catch(e => setErr(String(e)));
  }, []);

  const t = data?.totals;
  return (
    <div className="view">
      <div className="stat-row" style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        {data
          ? (<>
              <Stat label="Faculties" value={String(t!.faculties)} sub="academic units" />
              <Stat label="Institutes" value={String(t!.institutes)} sub="research units" />
              <Stat label="Headcount" value={t!.headcount.toLocaleString()} sub="members" />
              <Stat label="With ORCID" value={t!.withOrcid.toLocaleString()} sub="identified" />
            </>)
          : (<>
              <Stat loading label="Faculties" sub="academic units" />
              <Stat loading label="Institutes" sub="research units" />
              <Stat loading label="Headcount" sub="members" />
              <Stat loading label="With ORCID" sub="identified" />
            </>)}
      </div>
      <section className="card">
        <SectionHead eyebrow="Institution domain" title="Organization tree" />
        {err && <div className="status error">Error: {err}</div>}
        <div className="org-tree">
          {data
            ? (data.faculties.length === 0
                ? <div className="muted">No faculties yet.</div>
                : data.faculties.map((f, i) => <FacultyNode key={i} f={f} />))
            : Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} block height={36} width="100%" style={{ marginBottom: 6 }} />
              ))}
        </div>
      </section>
    </div>
  );
}

let root: Root | null = null;
// Exported for the SPA page (spa/FacultiesPage.tsx) to invoke on every React
// mount — the legacy-mount.ts contract. Idempotent: unmounts the prior root
// first, so re-navigating back to /faculties re-renders cleanly.
export function mount() {
  const el = document.getElementById('faculties-root');
  if (!el) return;
  if (root) root.unmount();
  root = createRoot(el);
  root.render(<App />);
}
