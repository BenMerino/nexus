import React from 'react';
import type { PublicStats } from './tenant-builders';
import { ES } from './tenant-i18n';
import { KpiSpark } from './tenant-kpi-spark';

// Each KPI owns a jewel accent (rail + dot) and a decorative sparkline shape.
// The accent is a real token (--j-*), not per-card hex (N3).
interface KpiDef { key: keyof typeof ES.summary; label: string; accent: string; spark: 'area' | 'bars' | 'ring'; foot: string; }
const KPIS: KpiDef[] = [
  { key: 'publications', label: ES.summary.publications, accent: 'var(--j-sapphire)', spark: 'area', foot: 'Indexed & de-duplicated' },
  { key: 'citations',    label: ES.summary.citations,    accent: 'var(--j-amethyst)', spark: 'area', foot: 'Cumulative, all sources' },
  { key: 'openAccess',   label: ES.summary.openAccess,   accent: 'var(--j-emerald)',  spark: 'ring', foot: 'Of corpus freely available' },
  { key: 'authors',      label: ES.summary.authors,      accent: 'var(--j-topaz)',    spark: 'bars', foot: 'ORCID-linked researchers' },
];

export function SummaryCards({ summary }: { summary: PublicStats['summary'] }) {
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
            <KpiSpark kind={k.spark} accent={k.accent} pct={k.key === 'openAccess' ? oaPct : undefined} />
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
