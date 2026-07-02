import React from 'react';
import { ScopedSummary } from './tenant-summary';
import { Skeleton } from '../ui/primitives';
import { ES } from './tenant-i18n';

/* The tenant page's loading state, built from the co-located component
 * skeletons (no parallel hand-built shimmer). Mirrors tenant.tsx's content
 * region: the KPI row (ScopedSummary.Skeleton) + the chart grid / works /
 * author-directory area below the scope rail. Rendered both on cold load and
 * as the chart-body Suspense fallback. */

function PanelSkel({ tall }: { tall?: boolean }) {
  return (
    <section className={`panel${tall ? ' tall' : ''}`}>
      <div className="panel-head">
        <div>
          <Skeleton block width={180} height={20} />
          <Skeleton block width={120} height={10} style={{ marginTop: 8 }} />
        </div>
      </div>
      <Skeleton block height={tall ? 360 : 200} width="100%" radius="card" />
    </section>
  );
}

export function TenantLoadingBody() {
  return (
    <>
      <div className="chart-grid reveal-group">
        <PanelSkel tall />
        <PanelSkel />
        <PanelSkel />
        <PanelSkel />
      </div>
      <section style={{ marginTop: 24 }}>
        <h3 className="panel-title" style={{ marginBottom: 12 }}>{ES.nav.authors}</h3>
        <Skeleton block height={240} width="100%" radius="card" />
      </section>
    </>
  );
}

export function TenantLoading() {
  return (
    <>
      <ScopedSummary.Skeleton />
      <div className="tenant-layout">
        <aside className="tenant-rail">
          <div className="tenant-rail-head">
            <h2 className="tenant-rail-title">{ES.scopeRail.title}</h2>
            <p className="tenant-rail-note">{ES.scopeRail.note}</p>
          </div>
          <div className="tenant-rail-list" style={{ padding: 8 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} block height={34} width="100%" style={{ marginBottom: 6 }} />
            ))}
          </div>
        </aside>
        <div className="tenant-content"><TenantLoadingBody /></div>
      </div>
    </>
  );
}
