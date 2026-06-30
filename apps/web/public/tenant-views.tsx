import React, { Suspense, useEffect, useState } from 'react';
import { SectionHead } from './ui-kit';
import { AuthorsTable } from './tenant-authors';
import { TenantWorks } from './tenant-works';
import { TenantJournals } from './tenant-journals';
import { ScopedSummary } from './tenant-summary';
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

// Overview = whole-tenant KPIs + charts. The unit picker lives on the Faculties
// view now (FacultiesView), so Overview is single-column, always tenant-wide.
export function OverviewView({ slug, payload }: { slug: string; payload: Payload }) {
  return (
    <>
      <ScopedSummary slug={slug} stats={payload.stats} tenantId={payload.tenant.id} unit={null} />
      <Suspense fallback={<TenantLoadingBody />}>
        <TenantBody slug={slug} stats={payload.stats} tenantId={payload.tenant.id} charts={chartsFor(payload)} unit={null} />
      </Suspense>
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

// Faculties (card grid) + UnitDetailView live in tenant-faculties.tsx — the
// entity is rich enough to warrant its own file. Re-exported for the shell.
export { FacultiesView, UnitDetailView } from './tenant-faculties';
