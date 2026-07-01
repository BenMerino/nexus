import React, { useEffect, useState } from 'react';
import { SectionHead, Skeleton } from './ui-kit';
import { AreaDetail } from './tenant-journal-area';
import type { Area, JournalsResponse } from './tenant-journals-shared';

/* Public Journals view (slug-scoped, no auth). Venue domain, grouped by AREA
 * (the venue's dominant OpenAlex top-level concept — Physics/Medicine/etc.,
 * see db-journals.js). Two layers, same shape as Faculties' card-grid →
 * unit-detail drill-in:
 *   1. AreaGrid  — one card per area (from /journals?page=0's `areas` summary),
 *      ranked by journal count. Click drills in.
 *   2. AreaDetail (tenant-journal-area.tsx) — that area's journals as a
 *      table, SERVER-PAGED (?area=&page=&pageSize=).
 * Local component state, not URL routing — an area is a filter, not a
 * distinct entity like a faculty unit (contrast UnitDetailView's unitKey). */

function AreaCard({ a, max, onOpen }: { a: Area; max: number; onOpen: () => void }) {
  const share = max > 0 ? Math.max(2, Math.round((a.count / max) * 100)) : 0;
  return (
    <button className="fac-card" onClick={onOpen} aria-label={`Open ${a.name}`}>
      <div className="fac-card-name">{a.name}</div>
      <div className="fac-card-figure"><b>{a.count.toLocaleString()}</b> journals</div>
      <div className="fac-card-bar"><i style={{ width: `${share}%` }} /></div>
    </button>
  );
}

function CardSkeleton() {
  return (
    <div className="fac-card" aria-hidden="true">
      <Skeleton block width="80%" height={18} />
      <Skeleton block width={90} height={22} style={{ marginTop: 14 }} />
      <Skeleton block width="100%" height={4} style={{ marginTop: 10 }} />
    </div>
  );
}

export function TenantJournals({ slug }: { slug: string }) {
  const [areas, setAreas] = useState<Area[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [openArea, setOpenArea] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/public/${encodeURIComponent(slug)}/journals?page=0&pageSize=1`)
      .then(r => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((d: JournalsResponse) => { if (!cancelled) setAreas(d.areas || []); })
      .catch(e => { if (!cancelled) setErr(String(e)); });
    return () => { cancelled = true; };
  }, [slug]);

  if (openArea) {
    return (
      <section className="card">
        <AreaDetail slug={slug} area={openArea} back={() => setOpenArea(null)} />
      </section>
    );
  }

  const max = areas && areas.length ? Math.max(...areas.map(a => a.count)) : 0;

  return (
    <section className="card">
      <SectionHead eyebrow="Venue domain" title="Journals by area" />
      {err && <div className="status error">Error: {err}</div>}
      <div className="fac-grid">
        {areas
          ? areas.map(a => <AreaCard key={a.name} a={a} max={max} onOpen={() => setOpenArea(a.name)} />)
          : Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
      </div>
      {areas && areas.length === 0 && <div className="muted">No journals yet.</div>}
    </section>
  );
}
