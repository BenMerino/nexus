import React, { useEffect, useState } from 'react';
import type { PublicStats } from './tenant-builders';
import type { UnitScope } from './tenant-scope-rail';
import { ES } from './tenant-i18n';
import { KpiSpark, type SparkPoint } from './tenant-kpi-spark';
import { useKpiSparks } from './use-kpi-sparks';

// Fetch the unit-scoped summary KPIs; null unit → the tenant-wide summary in
// `stats` (no extra request). Renders the KPI row. Used full-width above the
// rail (mockup); the cards re-narrow when a unit is picked in the rail.
const EMPTY_SUMMARY: PublicStats['summary'] = { totalPubs: 0, totalCitations: 0, oaCount: 0, authorCount: 0 };

export function ScopedSummary({ slug, stats, tenantId, unit }: { slug: string; stats: PublicStats; tenantId: number; unit: UnitScope | null }) {
  // stats.summary is absent if the analytics payload wins the load race (it
  // carries no summary) — fall back to zeros so the cards never read undefined.
  const [summary, setSummary] = useState<PublicStats['summary']>(stats.summary ?? EMPTY_SUMMARY);
  const sparks = useKpiSparks(tenantId, unit?.unitKey ?? null);
  useEffect(() => {
    if (!unit?.unitKey) { setSummary(stats.summary ?? EMPTY_SUMMARY); return; }
    let cancelled = false;
    setSummary({ totalPubs: 0, totalCitations: 0, oaCount: 0, authorCount: 0 });
    fetch(`/api/public/${encodeURIComponent(slug)}/stats?chrome=1&unit=${encodeURIComponent(unit.unitKey)}`)
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: { stats: PublicStats }) => { if (!cancelled) setSummary(d.stats.summary); })
      .catch(() => { if (!cancelled) setSummary(stats.summary); });
    return () => { cancelled = true; };
  }, [slug, unit?.unitKey, stats.summary]);
  return <SummaryCards summary={summary} sparks={sparks} />;
}

// Each KPI owns a jewel accent (rail + dot), a glyph kind, and the per-year
// series (real data, from publications.kpiSparks) feeding it. The accent is a
// real token (--j-*), not per-card hex (N3). OA uses the ring (no series).
interface KpiDef { key: keyof typeof ES.summary; series: 'publications' | 'citations' | 'authors' | null; label: string; accent: string; spark: 'area' | 'bars' | 'ring'; foot: string; }
const KPIS: KpiDef[] = [
  { key: 'publications', series: 'publications', label: ES.summary.publications, accent: 'var(--j-sapphire)', spark: 'area', foot: 'Indexed & de-duplicated' },
  { key: 'citations',    series: 'citations',    label: ES.summary.citations,    accent: 'var(--j-amethyst)', spark: 'area', foot: 'Cumulative, all sources' },
  { key: 'openAccess',   series: null,           label: ES.summary.openAccess,   accent: 'var(--j-emerald)',  spark: 'ring', foot: 'Of corpus freely available' },
  { key: 'authors',      series: 'authors',      label: ES.summary.authors,      accent: 'var(--j-topaz)',    spark: 'bars', foot: 'ORCID-linked researchers' },
];

export function SummaryCards({ summary, sparks }: { summary: PublicStats['summary']; sparks?: { publications: SparkPoint[]; citations: SparkPoint[]; authors: SparkPoint[] } | null }) {
  const oaPct = summary.totalPubs > 0 ? Math.round((summary.oaCount / summary.totalPubs) * 100) : 0;
  const value = (k: keyof typeof ES.summary): React.ReactNode => {
    if (k === 'publications') return summary.totalPubs.toLocaleString();
    if (k === 'citations')    return summary.totalCitations.toLocaleString();
    if (k === 'authors')      return summary.authorCount.toLocaleString();
    return <>{oaPct}<span className="pct">%</span></>;
  };
  return (
    <div className="kpi-grid">
      {KPIS.map(k => (
        <div key={k.key} className="kpi" style={{ ['--kpi-accent' as string]: k.accent }}>
          <div className="kpi-top">
            <span className="kpi-label">{k.label}</span>
            <span className="kpi-dot" />
          </div>
          <div className="kpi-body">
            <div className="kpi-val num">{value(k.key)}</div>
            <KpiSpark kind={k.spark} accent={k.accent}
              series={k.series && sparks ? sparks[k.series] : undefined}
              pct={k.key === 'openAccess' ? oaPct : undefined} />
          </div>
          <div className="kpi-foot">{k.foot}</div>
        </div>
      ))}
    </div>
  );
}

export function SectionPlaceholder({ label, error }: { label: string; error?: string | null }) {
  return (
    <div style={{ padding: 24, color: error ? 'var(--danger, #c00)' : 'var(--fg-dim)', fontFamily: 'var(--mono)', fontSize: 13 }}>
      {error ? `${ES.failedPrefix}: ${error}` : ES.loadingLabel(label)}
    </div>
  );
}

// Lazy tab pane: not rendered until first activated, then kept mounted so
// per-tab state (pagination, search, scroll) survives switching away and
// back. `display: none` when inactive — never unmount-on-hide.
export function TabPane({ id, active, seen, children }: {
  id: string; active: string; seen: Set<string>; children: React.ReactNode;
}) {
  if (!seen.has(id)) return null;
  return <section id={id} style={{ display: active === id ? 'block' : 'none' }}>{children}</section>;
}
