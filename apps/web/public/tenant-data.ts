import { useEffect, useState } from 'react';
import type { PublicStats } from './tenant-builders';
import { ES } from './tenant-i18n';

interface TenantChrome {
  id: number; name: string; slug: string | null; ror_id: string | null;
  logo_url: string | null; primary_color: string | null; secondary_color: string | null;
}
export interface StatsPayload { tenant: TenantChrome; stats: PublicStats; }

// Href to one academic's public profile. Production URLs are path-shaped
// (/t/:slug/a/:orcid, Caddy rewrites to author.html); the Vite dev server has
// no rewrite, so fall back to query params when not on a /t/ path.
export function authorProfileHref(slug: string, orcid: string): string {
  return window.location.pathname.startsWith('/t/')
    ? `/t/${encodeURIComponent(slug)}/a/${encodeURIComponent(orcid)}`
    : `/author.html?slug=${encodeURIComponent(slug)}&orcid=${encodeURIComponent(orcid)}`;
}

// Org-tree summary (unit aggregates, people stripped server-side), fetched ONCE
// per page load — the scope rail and the contributors panel both read it, and
// it's the slowest public endpoint; a module-level promise cache dedupes the
// two consumers. Failures aren't cached so a retry can succeed.
const orgTreePromises = new Map<string, Promise<unknown>>();
export function fetchOrgTreeSummary<T>(slug: string): Promise<T> {
  let p = orgTreePromises.get(slug);
  if (!p) {
    p = fetch(`/api/public/${encodeURIComponent(slug)}/org-tree?summary=1`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`Org tree failed (${r.status})`))));
    orgTreePromises.set(slug, p);
    p.catch(() => orgTreePromises.delete(slug));
  }
  return p as Promise<T>;
}

// Href to the tenant page, optionally pre-scoped to one org unit (?unit=
// unitKey — read on boot by tenant.tsx and resolved by the scope rail).
export function tenantHref(slug: string, unitKey?: string | null): string {
  const base = window.location.pathname.startsWith('/t/')
    ? `/t/${encodeURIComponent(slug)}`
    : `/tenant.html?slug=${encodeURIComponent(slug)}`;
  if (!unitKey) return base;
  return `${base}${base.includes('?') ? '&' : '?'}unit=${encodeURIComponent(unitKey)}`;
}

export function readSlugFromUrl(): string | null {
  const qSlug = new URLSearchParams(window.location.search).get('slug');
  const pathMatch = window.location.pathname.match(/^\/t\/([^\/?#]+)/);
  return qSlug || (pathMatch ? pathMatch[1] : null);
}

// Two-phase stats fetch so the shell paints fast:
//   1. ?chrome=1   → tenant + {summary, yearRange} — gates the page (cheap).
//   2. ?analytics=1 → the heavy chart aggregates — merged in when they land,
//      so the charts tab fills without ever blocking header/nav/overview.
// A 404 on chrome is fatal (no tenant name/branding to render). Analytics
// errors are non-fatal (charts show empty).
export function useTenantData(slug: string | null) {
  const [statsPayload, setStatsPayload] = useState<StatsPayload | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    const base = `/api/public/${encodeURIComponent(slug)}`;
    // chrome (gates the shell) and analytics (fills the charts tab) are
    // INDEPENDENT reads — fire them in PARALLEL. Previously analytics was
    // chained inside chrome's .then, so it couldn't start until chrome's full
    // round-trip finished (~1.3s wasted). Now both race; chrome still paints
    // the shell the instant it lands, analytics merges whenever it arrives.
    fetch(`${base}/stats?chrome=1`)
      .then(async r => {
        if (r.status === 404) throw new Error(ES.tenantNotFound);
        if (!r.ok) throw new Error(`${ES.failedPrefix} stats (${r.status})`);
        return r.json() as Promise<StatsPayload>;
      })
      .then(d => {
        // Seed the heavy chart arrays empty so `stats` is shape-complete for
        // the chrome phase (charts render empty until the analytics fetch
        // merges in); components already guard on `.length`/optional fields.
        const seeded: StatsPayload = { ...d, stats: { yearSource: [], yearByIndex: [], ...d.stats } };
        setStatsPayload(prev => prev ? { ...prev, ...seeded, stats: { ...seeded.stats, ...prev.stats } } : seeded);
        if (d.tenant.primary_color) document.body.style.setProperty('--primary', d.tenant.primary_color);
        if (d.tenant.secondary_color) document.body.style.setProperty('--secondary', d.tenant.secondary_color);
        document.title = `${d.tenant.name} — ${ES.research}`;
      })
      .catch(e => {
        if (e.message === ES.tenantNotFound) setFatalError(e.message);
        else setStatsError(e.message);
      });

    // Heavy analytics — fired alongside chrome, not after it. Merges onto
    // whatever stats are present (chrome may land first or this may).
    fetch(`${base}/stats?analytics=1`)
      .then(r => (r.ok ? r.json() as Promise<StatsPayload> : Promise.reject(r.status)))
      .then(a => setStatsPayload(prev => prev
        ? { ...prev, stats: { ...prev.stats, ...a.stats } }
        : { ...a, stats: { yearSource: [], yearByIndex: [], ...a.stats } }))
      .catch(() => { /* charts tab shows empty; shell already painted */ });
  }, [slug]);

  return { statsPayload, statsError, fatalError };
}
