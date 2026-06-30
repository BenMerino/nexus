import React, { Suspense, useEffect, useState } from 'react';
import { SectionHead, Skeleton } from './ui-kit';
import { AuthorsTable } from './tenant-authors';
import { TenantWorks } from './tenant-works';
import { TenantJournals } from './tenant-journals';
import { ScopedSummary } from './tenant-summary';
import { TenantScopeRail } from './tenant-scope-rail';
import { useUnitScope } from './use-unit-scope';
import { TenantLoadingBody } from './tenant-loading';
import { buildTenantCharts } from './tenant-builders';
import type { useTenantData } from './tenant-data';
import { ES } from './tenant-i18n';

/* The public entity views. Each is slug-scoped, read-only, composing the
 * existing public components. The shell (tenant.tsx) swaps these by route. */

type Payload = NonNullable<ReturnType<typeof useTenantData>['statsPayload']>;

// Overview = the rich default view: KPI row + scope rail + lazy chart body.
// The chart grid lives behind React.lazy (its import chain carries the ~380KB
// vendored engine chunk), so the shell paints from the small page chunk first.
const TenantBody = React.lazy(() => import('./tenant-body'));

// Per-payload memoized seed (stable identity so a legend toggle can't re-seed
// the engine's activeSet). WeakMap keyed on the payload object.
const _chartCache = new WeakMap<object, ReturnType<typeof buildTenantCharts>>();
function chartsFor(payload: Payload) {
  let c = _chartCache.get(payload);
  if (!c) { c = buildTenantCharts(payload.stats, payload.tenant.id); _chartCache.set(payload, c); }
  return c;
}

export function OverviewView({ slug, payload }: { slug: string; payload: Payload }) {
  const { initialUnitKey, unit, setUnit, unitReady, markUnitReady } = useUnitScope();
  return (
    <>
      <ScopedSummary slug={slug} stats={payload.stats} tenantId={payload.tenant.id} unit={unit} />
      <div className="tenant-layout">
        <aside className="tenant-rail">
          <div className="tenant-rail-head">
            <h2 className="tenant-rail-title">{ES.scopeRail.title}</h2>
            <p className="tenant-rail-note">{ES.scopeRail.note}</p>
          </div>
          <div className="tenant-rail-list">
            <TenantScopeRail slug={slug} tenantName={payload.tenant.name} selected={unit} onSelect={setUnit}
              initialKey={initialUnitKey} onInitialResolved={markUnitReady} />
          </div>
        </aside>
        <div className="tenant-content">
          {unitReady ? (
            <Suspense fallback={<TenantLoadingBody />}>
              <TenantBody slug={slug} stats={payload.stats} tenantId={payload.tenant.id} charts={chartsFor(payload)} unit={unit} />
            </Suspense>
          ) : <TenantLoadingBody />}
        </div>
      </div>
    </>
  );
}

export function AcademicsView({ slug }: { slug: string }) {
  return (
    <section className="card">
      <SectionHead eyebrow="Author domain" title="Academics" />
      <AuthorsTable slug={slug} />
    </section>
  );
}

export function PapersView({ slug }: { slug: string }) {
  // TenantWorks renders the most-cited + recent publication panels (slug-scoped).
  return <TenantWorks slug={slug} />;
}

export function JournalsView({ slug }: { slug: string }) {
  return <TenantJournals slug={slug} />;
}

// ── Faculties: the public org tree (faculty → department → headcount) ────────
type Dept = { name: string; headcount: number; papers: number };
type Faculty = { name: string; kind?: string; headcount: number; papers: number; departments: Dept[] };

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
              <span className="org-metrics"><span className="org-pill">{d.papers} papers</span></span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function FacultiesView({ slug }: { slug: string }) {
  const [faculties, setFaculties] = useState<Faculty[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/public/${encodeURIComponent(slug)}/org-tree`)
      .then(r => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((d: { faculties: Faculty[] }) => { if (!cancelled) setFaculties(d.faculties || []); })
      .catch(e => { if (!cancelled) setErr(String(e)); });
    return () => { cancelled = true; };
  }, [slug]);
  return (
    <section className="card">
      <SectionHead eyebrow="Institution domain" title="Faculties & institutes" />
      {err && <div className="status error">Error: {err}</div>}
      <div className="org-tree">
        {faculties
          ? (faculties.length === 0
              ? <div className="muted">No faculties yet.</div>
              : faculties.map((f, i) => <FacultyNode key={i} f={f} />))
          : Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} block height={36} width="100%" style={{ marginBottom: 6 }} />
            ))}
      </div>
    </section>
  );
}
