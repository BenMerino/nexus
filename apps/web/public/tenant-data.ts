import { useEffect, useState } from 'react';
import type { PublicStats } from './tenant-builders';
import { ES } from './tenant-i18n';

interface TenantChrome {
  id: number; name: string; slug: string | null; ror_id: string | null;
  logo_url: string | null; primary_color: string | null; secondary_color: string | null;
}
export interface StatsPayload { tenant: TenantChrome; stats: PublicStats; }
export interface GraphPayload { graph: { nodes: any[]; edges: any[] }; }

export function readSlugFromUrl(): string | null {
  const qSlug = new URLSearchParams(window.location.search).get('slug');
  const pathMatch = window.location.pathname.match(/^\/t\/([^\/?#]+)/);
  return qSlug || (pathMatch ? pathMatch[1] : null);
}

// Fetches /stats (gates the page) and /graph (degrades gracefully) in
// parallel. A 404 on /stats is fatal because we can't even render the
// page chrome without the tenant name + branding. Graph errors stay
// scoped to the graph tab.
export function useTenantData(slug: string | null) {
  const [statsPayload, setStatsPayload] = useState<StatsPayload | null>(null);
  const [graphPayload, setGraphPayload] = useState<GraphPayload | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [graphError, setGraphError] = useState<string | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/public/${encodeURIComponent(slug)}/stats`)
      .then(async r => {
        if (r.status === 404) throw new Error(ES.tenantNotFound);
        if (!r.ok) throw new Error(`${ES.failedPrefix} stats (${r.status})`);
        return r.json() as Promise<StatsPayload>;
      })
      .then(d => {
        setStatsPayload(d);
        if (d.tenant.primary_color) document.body.style.setProperty('--primary', d.tenant.primary_color);
        if (d.tenant.secondary_color) document.body.style.setProperty('--secondary', d.tenant.secondary_color);
        document.title = `${d.tenant.name} — ${ES.research}`;
      })
      .catch(e => {
        if (e.message === ES.tenantNotFound) setFatalError(e.message);
        else setStatsError(e.message);
      });

    fetch(`/api/public/${encodeURIComponent(slug)}/graph`)
      .then(async r => {
        if (!r.ok) throw new Error(`${ES.failedPrefix} graph (${r.status})`);
        return r.json() as Promise<GraphPayload>;
      })
      .then(setGraphPayload)
      .catch(e => setGraphError(e.message));
  }, [slug]);

  return { statsPayload, graphPayload, statsError, graphError, fatalError };
}
