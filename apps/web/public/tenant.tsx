import React, { useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { TenantPublicHeader, type PublicNavItem } from './tenant-header';
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

// Entity tabs (shareable /t/:slug/<entity> URLs; client-swapped via pushState).
const NAV: PublicNavItem[] = [
  { id: 'overview',  label: 'Overview' },
  { id: 'faculties', label: 'Faculties' },
  { id: 'academics', label: 'Academics' },
  { id: 'papers',    label: 'Papers' },
  { id: 'journals',  label: 'Journals' },
];

// Map the active entity view to its content. Overview keeps its rich layout;
// the others are slug-scoped composed views (instant client-side swap).
function ViewContent({ view, slug, payload }: {
  view: PublicView; slug: string; payload: NonNullable<ReturnType<typeof useTenantData>['statsPayload']>;
}) {
  switch (view) {
    case 'faculties': return <FacultiesView slug={slug} />;
    case 'academics': return <AcademicsView slug={slug} />;
    case 'papers':    return <PapersView slug={slug} />;
    case 'journals':  return <JournalsView slug={slug} />;
    default:          return <OverviewView slug={slug} payload={payload} />;
  }
}

function App() {
  const [slug] = useState<string | null>(() => readSlugFromUrl());
  const { statsPayload, statsError, fatalError } = useTenantData(slug);
  const { view, navigate } = usePublicRoute();

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
  if (!statsPayload) {
    return (
      <div className="public-app">
        <main className="public-main">
          <div className="public-content">
            {statsError
              ? <div style={{ color: 'var(--danger, #c00)' }}>{`${ES.failedPrefix}: ${statsError}`}</div>
              : <TenantLoading />}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="public-app">
      <TenantPublicHeader tenant={statsPayload.tenant} items={NAV} currentId={view}
        onNavigate={(id) => navigate(id as PublicView)} yearRange={statsPayload.stats.yearRange}
        lastUpdated={statsPayload.stats.lastUpdated}
        search={<TenantSearch slug={slug} onSelectUnit={() => {}} />} />
      <main className="public-main">
        <div className="public-content">
          <ViewContent view={view} slug={slug} payload={statsPayload} />
          <TenantFooter yearRange={statsPayload.stats.yearRange} />
        </div>
      </main>
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
