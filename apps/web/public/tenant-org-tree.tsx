import React, { useEffect, useState } from 'react';

interface Person { name: string; category: string | null; orcid: string | null; paperCount: number; }
interface Department { name: string; headcount: number; withOrcid: number; papers: number; people: Person[]; }
interface Faculty {
  name: string;
  kind: 'faculty' | 'institute' | 'other';
  headcount: number; withOrcid: number; papers: number;
  departments: Department[];
}
interface OrgTree {
  totals: { headcount: number; withOrcid: number; papers: number; faculties: number; institutes: number; units: number; };
  faculties: Faculty[];
}

const KIND_LABEL: Record<Faculty['kind'], string> = { faculty: 'Facultad', institute: 'Instituto', other: 'Otras' };

function Metrics({ head, withOrcid, papers }: { head: number; withOrcid: number; papers: number }) {
  const full = head > 0 && withOrcid === head;
  return (
    <span className="org-metrics">
      <span className="org-pill">{head} {head === 1 ? 'academic' : 'academics'}</span>
      <span className={`org-pill${full ? ' cov-full' : ''}`}>{withOrcid}/{head} ORCID</span>
      <span className="org-pill">{papers} {papers === 1 ? 'paper' : 'papers'}</span>
    </span>
  );
}

function PersonRow({ p }: { p: Person }) {
  return (
    <div className="org-node">
      <div className="org-row leaf">
        <span className="org-twist" />
        <span className="org-name person">{p.name} <span className="text-muted">· {p.category || ''}</span></span>
        <span className="org-metrics">
          {p.orcid
            ? <a className="org-orcid" href={`https://orcid.org/${p.orcid}`} target="_blank" rel="noopener noreferrer">{p.orcid}</a>
            : <span className="org-orcid none">no ORCID</span>}
          <span className="org-pill">{p.paperCount} {p.paperCount === 1 ? 'paper' : 'papers'}</span>
        </span>
      </div>
    </div>
  );
}

function Branch({ label, cls, head, withOrcid, papers, children }: {
  label: React.ReactNode; cls: string; head: number; withOrcid: number; papers: number; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="org-node">
      <div className="org-row" onClick={() => setOpen(o => !o)}>
        <span className={`org-twist${open ? ' open' : ''}`}>▶</span>
        <span className={`org-name ${cls}`}>{label}</span>
        <Metrics head={head} withOrcid={withOrcid} papers={papers} />
      </div>
      <div className={`org-children${open ? ' open' : ''}`}>{children}</div>
    </div>
  );
}

export function TenantOrgTree({ slug }: { slug: string }) {
  const [data, setData] = useState<OrgTree | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/public/${encodeURIComponent(slug)}/org-tree`)
      .then(async r => {
        if (!r.ok) throw new Error(`Org tree failed (${r.status})`);
        return r.json() as Promise<OrgTree>;
      })
      .then(setData)
      .catch(e => setError(e.message));
  }, [slug]);

  if (error) return <div className="org-err" style={{ padding: 14 }}>{error}</div>;
  if (!data) return <div style={{ padding: 14, color: 'var(--fg-dim)', fontFamily: 'var(--mono)', fontSize: 13 }}>Loading organisation scheme…</div>;
  if (!data.faculties.length) return <div className="text-muted text-small" style={{ padding: 14 }}>No roster data for this tenant yet.</div>;

  return (
    <>
      <div style={{ display: 'flex', gap: 18, fontSize: 12, color: 'var(--fg-muted)', fontFamily: 'var(--mono)', padding: '6px 0 14px', flexWrap: 'wrap' }}>
        <span>{data.totals.faculties} faculties</span>
        <span>{data.totals.institutes} institutes</span>
        <span>{data.totals.headcount} academics</span>
        <span>{data.totals.withOrcid} with ORCID</span>
        <span>{data.totals.papers} papers</span>
      </div>
      <div className="org-tree">
        {data.faculties.map(f => (
          <Branch key={f.name}
            label={<>{f.name}{KIND_LABEL[f.kind] ? <span className="org-kind"> {KIND_LABEL[f.kind]}</span> : null}</>}
            cls="fac"
            head={f.headcount} withOrcid={f.withOrcid} papers={f.papers}>
            {f.departments.map(d => (
              <Branch key={d.name} label={d.name} cls="dep"
                head={d.headcount} withOrcid={d.withOrcid} papers={d.papers}>
                {d.people.map((p, i) => <PersonRow key={`${p.orcid || p.name}-${i}`} p={p} />)}
              </Branch>
            ))}
          </Branch>
        ))}
      </div>
    </>
  );
}
