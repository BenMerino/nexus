import React from 'react';
import { ScopedSummary } from './tenant-summary';
import { Skeleton } from '../ui/primitives';
import { ES } from './tenant-i18n';

/* The tenant page's loading state, built from the co-located component
 * skeletons (no parallel hand-built shimmer). Mirrors tenant.tsx's content
 * region: the KPI row (ScopedSummary.Skeleton) + the chart grid / works /
 * author-directory area below the scope rail. Rendered both on cold load and
 * as the chart-body Suspense fallback. */

/* One panel skeleton. `span` = the grid modifier ('tall' | 'full'); `body` =
   the reserved body height, matched to each real card's chart minHeight so the
   skeleton reserves the SAME space the loaded card fills (no reflow on swap). */
function PanelSkel({ span, body = 240 }: { span?: 'tall' | 'full'; body?: number }) {
  return (
    <section className={`panel${span ? ' ' + span : ''}`}>
      <div className="panel-head">
        <div>
          <Skeleton block width={180} height={20} />
          <Skeleton block width={120} height={10} style={{ marginTop: 8 }} />
        </div>
      </div>
      <Skeleton block height={body} width="100%" radius="card" />
    </section>
  );
}

export function TenantLoadingBody() {
  // Mirror the REAL TenantOverview card structure card-for-card so the skeleton
  // reserves the same layout the loaded grid fills (matched counts, spans and
  // per-card body heights) — otherwise data lands into a different-shaped grid
  // and the whole thing reflows. Structure (tenant-charts-tab + tenant-overview):
  //   grid 1: contributors(tall) · velocity · researchAreas · year-panel(full)
  //   grid 2: topJournals · collaborators · countriesMap(full)
  //   then: works · authors
  return (
    <>
      <div className="chart-grid">
        <PanelSkel span="tall" body={360} />
        <PanelSkel body={200} />
        <PanelSkel body={200} />
        <PanelSkel span="full" body={300} />
      </div>
      <div className="chart-grid" style={{ marginTop: 24 }}>
        <PanelSkel body={300} />
        <PanelSkel body={300} />
        <PanelSkel span="full" body={300} />
      </div>
      {/* Works: most-cited + recent publications — a third chart-grid (2 cards),
          matching TenantWorks so the card count is 9, same as loaded. */}
      <div className="chart-grid" style={{ marginTop: 24 }}>
        <PanelSkel body={340} />
        <PanelSkel body={340} />
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
