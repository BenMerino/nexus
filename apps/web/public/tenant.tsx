import React, { useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { PublicShell } from './public-shell';
import { TenantFooter } from './tenant-footer';
import { useTenantData, readSlugFromUrl } from './tenant-data';
import { TenantLoading } from './tenant-loading';
import { usePublicRoute, type PublicView } from './use-public-route';
import { OverviewView, AcademicsView, PapersView, JournalsView, FacultiesView, UnitDetailView } from './tenant-views';
import { ES } from './tenant-i18n';
import { bootStreamBridge } from '../architect/websocket-connector';
import { perfMark, perfAutoFlush } from './perf-marks';

perfMark('boot'); // module evaluated — bundles parsed, app about to mount

// Map the active entity view to its content. Overview keeps its rich layout;
// the others are slug-scoped composed views (instant client-side swap).
function ViewContent({ view, unitKey, slug, payload, navigateUnit, navigate }: {
  view: PublicView; unitKey: string | null; slug: string;
  payload: NonNullable<ReturnType<typeof useTenantData>['statsPayload']>;
  navigateUnit: (k: string) => void; navigate: (v: PublicView) => void;
}) {
  switch (view) {
    case 'faculties': return unitKey
      ? <UnitDetailView slug={slug} payload={payload} unitKey={unitKey} back={() => navigate('faculties')} />
      : <FacultiesView slug={slug} navigateUnit={navigateUnit} />;
    case 'academics': return <AcademicsView slug={slug} />;
    case 'papers':    return <PapersView slug={slug} />;
    case 'journals':  return <JournalsView slug={slug} />;
    default:          return <OverviewView slug={slug} payload={payload} />;
  }
}

function App() {
  const [slug] = useState<string | null>(() => readSlugFromUrl());
  const { statsPayload, statsError, fatalError } = useTenantData(slug);
  const { view, unitKey, navigate, navigateUnit, hrefFor } = usePublicRoute();

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

  // The shell builds the whole grid + header + sidebar + search identically for
  // every public page (N9); this page supplies CLIENT-SIDE routing (in-place view
  // swap via usePublicRoute) and its own content (loading / views / footer).
  return (
    <PublicShell
      tenant={statsPayload?.tenant ?? null}
      slug={slug}
      view={view}
      hrefFor={hrefFor}
      navigate={navigate}
      onSelectUnit={() => {}}
      yearRange={statsPayload?.stats.yearRange}
      lastUpdated={statsPayload?.stats.lastUpdated}
    >
      {!statsPayload
        ? (statsError
            ? <div style={{ color: 'var(--danger, #c00)' }}>{`${ES.failedPrefix}: ${statsError}`}</div>
            : <TenantLoading />)
        : (<>
            <ViewContent view={view} unitKey={unitKey} slug={slug} payload={statsPayload}
              navigateUnit={navigateUnit} navigate={navigate} />
            <TenantFooter yearRange={statsPayload.stats.yearRange} />
          </>)}
    </PublicShell>
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
// (Liquid-glass is now enabled platform-wide by sky-bg, which loads on every
// page — no per-page enable needed here.)

(window as any).__nexusMounts = (window as any).__nexusMounts || {};
(window as any).__nexusMounts[new URL(import.meta.url).pathname] = mount;
mount();
// Open the directive Stream bridge so charts go live (isLive) and re-push on
// ingestion. Idempotent; falls back to HTTP recompose when the socket is down.
bootStreamBridge();
