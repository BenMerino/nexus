import React, { useEffect, useState } from 'react';
import { SectionHead, Skeleton } from './ui-kit';
import { AuthorsTable } from './tenant-authors';
import { TenantWorks } from './tenant-works';
import { ScopedSummary } from './tenant-summary';
import type { useTenantData } from './tenant-data';
import { ES } from './tenant-i18n';

/* Faculties = the institution's richest entity. Presented as a CARD GRID (each
 * unit a clickable card carrying its output-share insight), drilling into a
 * dedicated unit detail view (scoped KPIs + academics + works) at
 * /t/:slug/faculties/:unitKey. Both layers compose existing slug-scoped,
 * unit-aware public endpoints — no new backend. */

type Payload = NonNullable<ReturnType<typeof useTenantData>['statsPayload']>;
type Unit = { name: string; unitKey: string | null; kind?: string; headcount: number; withOrcid: number; papers: number; citations: number };

const KIND_LABEL: Record<string, string> = { faculty: 'Faculty', institute: 'Institute', other: 'Other' };

function FacultyCard({ u, max, onOpen }: { u: Unit; max: number; onOpen: () => void }) {
  const share = max > 0 ? Math.max(2, Math.round((u.papers / max) * 100)) : 0;
  const orcidPct = u.headcount > 0 ? Math.round((u.withOrcid / u.headcount) * 100) : 0;
  return (
    <button className="fac-card" onClick={onOpen} aria-label={`Open ${u.name}`}>
      <div className="fac-card-kind">{KIND_LABEL[u.kind || 'other']}</div>
      <div className="fac-card-name">{u.name}</div>
      <div className="fac-card-figure"><b>{u.papers.toLocaleString()}</b> {ES.orgTree.paperMany}</div>
      <div className="fac-card-bar"><i style={{ width: `${share}%` }} /></div>
      <div className="fac-card-meta">
        <span>{u.headcount.toLocaleString()} people</span>
        <span>{orcidPct}% ORCID</span>
        <span>{u.citations.toLocaleString()} cites</span>
      </div>
    </button>
  );
}

function CardSkeleton() {
  return (
    <div className="fac-card" aria-hidden="true">
      <Skeleton block width={60} height={10} />
      <Skeleton block width="80%" height={18} style={{ marginTop: 8 }} />
      <Skeleton block width={90} height={22} style={{ marginTop: 14 }} />
      <Skeleton block width="100%" height={4} style={{ marginTop: 10 }} />
    </div>
  );
}

// ── The grid: cards ranked by output, clickable to drill in ──────────────────
export function FacultiesView({ slug, navigateUnit }: { slug: string; navigateUnit: (k: string) => void }) {
  const [units, setUnits] = useState<Unit[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/public/${encodeURIComponent(slug)}/org-tree?summary=1`)
      .then(r => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((d: { faculties: Unit[] }) => { if (!cancelled) setUnits(d.faculties || []); })
      .catch(e => { if (!cancelled) setErr(String(e)); });
    return () => { cancelled = true; };
  }, [slug]);

  const ranked = units ? [...units].sort((a, b) => b.papers - a.papers) : null;
  const max = ranked && ranked.length ? ranked[0].papers : 0;

  return (
    <section className="card">
      <div className="tenant-rail-head">
        <h2 className="tenant-rail-title">{ES.scopeRail.title}</h2>
        <p className="tenant-rail-note">{ES.scopeRail.note}</p>
      </div>
      {err && <div className="status error">Error: {err}</div>}
      <div className="fac-grid">
        {ranked
          ? (ranked.length === 0
              ? <div className="muted">No faculties yet.</div>
              : ranked.map((u, i) => (
                  <FacultyCard key={u.unitKey || i} u={u} max={max}
                    onOpen={() => u.unitKey && navigateUnit(u.unitKey)} />
                )))
          : Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
      </div>
    </section>
  );
}

// ── The drill-in: one unit's scoped KPIs + academics + works ─────────────────
export function UnitDetailView({ slug, payload, unitKey, back }: {
  slug: string; payload: Payload; unitKey: string; back: () => void;
}) {
  // Resolve the unit's display name from the org tree (the card grid had it,
  // but a deep-link lands here cold). Falls back to the key until it loads.
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/public/${encodeURIComponent(slug)}/org-tree?summary=1`)
      .then(r => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((d: { faculties: Unit[] }) => {
        const hit = d.faculties.find(f => f.unitKey === unitKey);
        if (!cancelled) setName(hit?.name ?? unitKey);
      })
      .catch(() => { if (!cancelled) setName(unitKey); });
    return () => { cancelled = true; };
  }, [slug, unitKey]);

  const unit = { unitKey, name: name ?? unitKey };
  return (
    <>
      <a className="profile-back" onClick={(e) => { e.preventDefault(); back(); }} href="#">← {ES.scopeRail.title}</a>
      <h1 className="view-title" style={{ margin: '6px 0 18px' }}>{name ?? '…'}</h1>
      <ScopedSummary slug={slug} stats={payload.stats} tenantId={payload.tenant.id} unit={unit} />
      <section className="card" style={{ marginTop: 16 }}>
        <SectionHead eyebrow="Author domain" title="Academics" />
        <AuthorsTable slug={slug} unit={unitKey} />
      </section>
      <div style={{ marginTop: 16 }}><TenantWorks slug={slug} unit={unitKey} /></div>
    </>
  );
}
