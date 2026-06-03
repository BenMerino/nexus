import React, { useEffect, useState, useMemo } from 'react';
import { DirectiveChart } from '../ui/graph-engine/index';
import type { GraphDirective } from '../architect/graph-composer.types';

/* Fetches a SERVER-COMPOSED chart directive by kind from the catalog endpoint
 * (/api/architect/recompose) and renders it. This is the blessed path for
 * time-series charts: the directive (with per-day ISO atoms) is built by the
 * Composer (PublicationCharts) — the page never builds it. Replaces the
 * client-side build*Chart helpers so a malformed (year-collapsed) shape can't
 * be produced here. Falls back to a quiet placeholder on error/empty. */
export function RecomposeChart({ kind, tenantId, minHeight = 360 }: { kind: string; tenantId: number; minHeight?: number }) {
  const [directive, setDirective] = useState<GraphDirective | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Tenant-public only. Researcher-scoped charts go through the authenticated
    // /charts path, never this anonymous endpoint (no orcid param honored here).
    // The handler reads the body AS the query (unwrapped {kind, tenantId, ...}).
    fetch('/api/architect/recompose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, tenantId: String(tenantId) }),
    })
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: GraphDirective | null) => { if (!cancelled) setDirective(d && (d as any).atoms ? d : null); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [kind, tenantId]);

  // Stable seed identity so DirectiveChart owns it cleanly.
  const seed = useMemo(() => directive, [directive]);

  if (failed || (seed === null)) {
    return <div style={{ minHeight, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-dim)', fontFamily: 'var(--mono)', fontSize: 13 }}>—</div>;
  }
  return <div style={{ minHeight }}><DirectiveChart seed={seed} /></div>;
}
