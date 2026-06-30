import { useEffect, useState, useCallback } from 'react';

/* Client routing for the public tenant shell. Entities are real, shareable
 * URLs — /t/:slug                       → overview
 *        /t/:slug/academics             → academics   (etc.)
 *        /t/:slug/faculties/:unitKey     → one unit's detail (drill-in)
 * Caddy rewrites every /t/:slug[/...] to tenant.html, so deep-links and refresh
 * resolve server-side; this hook reads the URL and navigates via pushState
 * (instant, no reload). Dev (no Caddy) falls back to ?view=&unit=. */

export const PUBLIC_VIEWS = ['overview', 'faculties', 'academics', 'papers', 'journals'] as const;
export type PublicView = typeof PUBLIC_VIEWS[number];

export interface PublicRoute { view: PublicView; unitKey: string | null; }

function readRoute(): PublicRoute {
  const path = window.location.pathname;
  const q = new URLSearchParams(window.location.search);
  // /t/:slug/<entity>[/<unitKey>]
  const m = path.match(/^\/t\/[^/]+\/([^/?#]+)(?:\/([^/?#]+))?/);
  const seg = m ? m[1] : q.get('view');
  const view = (PUBLIC_VIEWS as readonly string[]).includes(seg || '') ? (seg as PublicView) : 'overview';
  const unitKey = view === 'faculties'
    ? (m && m[2] ? decodeURIComponent(m[2]) : q.get('unit'))
    : null;
  return { view, unitKey };
}

function base(): string | null {
  const m = window.location.pathname.match(/^\/t\/([^/?#]+)/);
  return m ? `/t/${m[1]}` : null;
}

function viewHref(view: PublicView): string {
  const b = base();
  if (b) return view === 'overview' ? b : `${b}/${view}`;
  const q = new URLSearchParams(window.location.search);
  if (view === 'overview') q.delete('view'); else q.set('view', view);
  q.delete('unit');
  const qs = q.toString();
  return `${window.location.pathname}${qs ? `?${qs}` : ''}`;
}

function unitHref(unitKey: string): string {
  const b = base();
  if (b) return `${b}/faculties/${encodeURIComponent(unitKey)}`;
  const q = new URLSearchParams(window.location.search);
  q.set('view', 'faculties'); q.set('unit', unitKey);
  return `${window.location.pathname}?${q.toString()}`;
}

export function usePublicRoute() {
  const [route, setRoute] = useState<PublicRoute>(() => readRoute());

  useEffect(() => {
    const onPop = () => setRoute(readRoute());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((next: PublicView) => {
    window.history.pushState(null, '', viewHref(next));
    setRoute({ view: next, unitKey: null });
  }, []);

  const navigateUnit = useCallback((unitKey: string) => {
    window.history.pushState(null, '', unitHref(unitKey));
    setRoute({ view: 'faculties', unitKey });
  }, []);

  return { view: route.view, unitKey: route.unitKey, navigate, navigateUnit, hrefFor: viewHref, unitHrefFor: unitHref };
}
