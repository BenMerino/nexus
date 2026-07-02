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
  // Mirror the LOADED OverviewView structure exactly: KPI row + the full-width
  // chart-grid body, NO scope rail. The old .tenant-layout + .tenant-rail here
  // reserved a 264px column the Overview never renders, so content jumped
  // 924→1204px (and every card resized) when data swapped in. Matching the
  // real layout means the skeleton cards are the same size/form as the loaded
  // cards — zero reflow on data arrival.
  return (
    <>
      <ScopedSummary.Skeleton />
      <TenantLoadingBody />
    </>
  );
}
