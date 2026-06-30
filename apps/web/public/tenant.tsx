import React, { useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { TenantPublicHeader } from './tenant-header';
import { TenantSidebar } from './tenant-sidebar';
import { TenantSearch } from './tenant-search';
import { TenantFooter } from './tenant-footer';
import { useTenantData, readSlugFromUrl } from './tenant-data';
import { TenantLoading } from './tenant-loading';
import { usePublicRoute, type PublicView } from './use-public-route';
import { OverviewView, AcademicsView, PapersView, JournalsView, FacultiesView } from './tenant-views';
import { ES } from './tenant-i18n';
import { bootStreamBridge } from '../architect/websocket-connector';
import { perfMark, perfAutoFlush } from './perf-marks';

perfMark('boot'); // module evaluated — bundles parsed, app about to mount

// Map the active entity view to its content. Overview keeps its rich layout;
// the others are slug-scoped composed views (instant client-side swap).
function ViewContent({ view, slug, payload }: {
  view: PublicView; slug: string; payload: NonNullable<ReturnType<typeof useTenantData>['statsPayload']>;
}) {
  switch (view) {
    case 'faculties': return <FacultiesView slug={slug} tenantName={payload.tenant.name} />;
    case 'academics': return <AcademicsView slug={slug} />;
    case 'papers':    return <PapersView slug={slug} />;
    case 'journals':  return <JournalsView slug={slug} />;
    default:          return <OverviewView slug={slug} payload={payload} />;
  }
}

function App() {
  const [slug] = useState<string | null>(() => readSlugFromUrl());
  const { statsPayload, statsError, fatalError } = useTenantData(slug);
  const { view, navigate, hrefFor } = usePublicRoute();

  useEffect(() => {
    if (!statsPayload) return;
    perfMark('shell');
    if (statsPayload.stats.velocity) perfMark('analytics');
    if (slug) perfAutoFlush(slug);
  }, [statsPayload, slug]);

  // Preload the engine chunk (Overview's charts) in parallel with chrome.
  useEffect(() => { void import('./tenant-body'); }, []);

  if (!slug) {
    return <div className="public-app"><main className="public-main" style={{ color: 'var(--danger, #c00)' }}>{ES.missingSlug}</main></div>;
  }
  if (fatalError) {
    return <div className="public-app"><main className="public-main" style={{ color: 'var(--danger, #c00)' }}>{fatalError}</main></div>;
  }

  // App grid: floating glass nav sidebar (left) + main column (floating header
  // + scrolling content). The entity nav lives on the sidebar, not the header.
  const tenantName = statsPayload?.tenant.name ?? '';
  return (
    <div className="app">
      {/* Row 1: full-width header on top. Row 2: floating sidebar + content. */}
      {statsPayload && (
        <TenantPublicHeader tenant={statsPayload.tenant} items={[]} currentId={view}
          onNavigate={() => {}} yearRange={statsPayload.stats.yearRange}
          lastUpdated={statsPayload.stats.lastUpdated}
          search={<TenantSearch slug={slug} onSelectUnit={() => {}} />} />
      )}
      <TenantSidebar tenantName={tenantName} view={view} navigate={navigate} hrefFor={hrefFor} />
      <div className="public-app">
        <main className="public-main">
          <div className="public-content">
            {!statsPayload
              ? (statsError
                  ? <div style={{ color: 'var(--danger, #c00)' }}>{`${ES.failedPrefix}: ${statsError}`}</div>
                  : <TenantLoading />)
              : (<>
                  <ViewContent view={view} slug={slug} payload={statsPayload} />
                  <TenantFooter yearRange={statsPayload.stats.yearRange} />
                </>)}
          </div>
        </main>
      </div>
    </div>
  );
}

let tenantRoot: Root | null = null;
function mount() {
  const el = document.getElementById('tenant-root');
  if (!el) return;
  if (tenantRoot) tenantRoot.unmount();
  tenantRoot = createRoot(el);
  tenantRoot.render(<App />);
}
(window as any).__nexusMounts = (window as any).__nexusMounts || {};
(window as any).__nexusMounts[new URL(import.meta.url).pathname] = mount;
mount();
// Open the directive Stream bridge so charts go live (isLive) and re-push on
// ingestion. Idempotent; falls back to HTTP recompose when the socket is down.
bootStreamBridge();
