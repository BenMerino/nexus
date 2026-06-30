import { useEffect, useState, useCallback } from 'react';

/* Client routing for the public tenant shell. Entities are real, shareable
 * URLs — /t/:slug            → overview
 *        /t/:slug/academics  → academics   (etc.)
 * Caddy rewrites every /t/:slug[/<entity>] to tenant.html, so deep-links and
 * refresh resolve server-side; this hook reads which entity the URL names and
 * navigates between them via history.pushState (instant, no reload). Dev (no
 * Caddy) falls back to ?view=<entity>. */

export const PUBLIC_VIEWS = ['overview', 'faculties', 'academics', 'papers', 'journals'] as const;
export type PublicView = typeof PUBLIC_VIEWS[number];

function readView(): PublicView {
  // /t/:slug/<entity> — the segment after the slug
  const m = window.location.pathname.match(/^\/t\/[^/]+\/([^/?#]+)/);
  const seg = m ? m[1] : new URLSearchParams(window.location.search).get('view');
  return (PUBLIC_VIEWS as readonly string[]).includes(seg || '') ? (seg as PublicView) : 'overview';
}

// Build the path for an entity, preserving the existing /t/:slug or ?slug= form.
function viewHref(view: PublicView): string {
  const path = window.location.pathname;
  const tMatch = path.match(/^\/t\/([^/?#]+)/);
  if (tMatch) {
    const base = `/t/${tMatch[1]}`;
    return view === 'overview' ? base : `${base}/${view}`;
  }
  // dev / ?slug= form: keep slug, swap ?view=
  const q = new URLSearchParams(window.location.search);
  if (view === 'overview') q.delete('view'); else q.set('view', view);
  const qs = q.toString();
  return `${path}${qs ? `?${qs}` : ''}`;
}

export function usePublicRoute() {
  const [view, setView] = useState<PublicView>(() => readView());

  useEffect(() => {
    const onPop = () => setView(readView());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((next: PublicView) => {
    if (next === view) return;
    window.history.pushState(null, '', viewHref(next));
    setView(next);
  }, [view]);

  return { view, navigate, hrefFor: viewHref };
}
