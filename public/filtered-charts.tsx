import React, { useState, useEffect } from 'react';
import { CartesianRender } from '../graph-engine/cartesian-render.js';
import { RadialRender } from '../graph-engine/radial-render.js';
import type { GraphDirective } from '../architect/graph-composer.types.js';
import type { TagNode, DoiRecord } from './relationship-types';
import { TAG_CATEGORIES, COLORS } from './relationship-types';
import { FilteredPaperList } from './filtered-paper-list';

function ChartCard({ chart }: { chart: GraphDirective }) {
  const isDonut = chart.type === 'donut' || chart.type === 'pie';
  return (
    <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 8, padding: '8px 10px 4px', overflow: 'hidden' }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#888', marginBottom: 4 }}>{chart.title}</div>
      {isDonut ? <RadialRender chart={chart} size={200} /> : <CartesianRender chart={chart} width={340} height={160} />}
    </div>
  );
}

export function StatsBar({ nodes, edges, doiCount }: { nodes: TagNode[]; edges: { weight: number }[]; doiCount: number }) {
  return (
    <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#666', fontFamily: 'monospace', padding: '8px 0', flexWrap: 'wrap' }}>
      <span>{nodes.length} tags</span>
      <span>{edges.length} connections</span>
      <span style={{ color: '#333' }}>{doiCount} papers</span>
      {TAG_CATEGORIES.map(cat => {
        const count = nodes.filter(n => n.group === cat).length;
        if (!count) return null;
        return <span key={cat} style={{ color: COLORS[cat] }}>{count} {cat}{count !== 1 ? 's' : ''}</span>;
      })}
    </div>
  );
}

const scheme = (color: string): GraphDirective['colorScheme'] => ({
  sentiment: 'neutral' as const, primary: color, fill: color, gradient: [color, color],
});

function buildCharts(filtered: DoiRecord[]): GraphDirective[] {
  const charts: GraphDirective[] = [];

  const withCitations = filtered.filter(r => r.citation_count > 0).sort((a, b) => b.citation_count - a.citation_count).slice(0, 15);
  if (withCitations.length > 0) {
    charts.push({ type: 'bar', title: 'Citations', yLabel: 'Citations', colorScheme: scheme('#3b82f6'), data: withCitations.map(r => ({ label: (r.title || r.doi).substring(0, 22), value: r.citation_count })) });
  }

  const typeMap = new Map<string, number>();
  for (const r of filtered) typeMap.set(r.type || 'unknown', (typeMap.get(r.type || 'unknown') || 0) + 1);
  if (typeMap.size > 0) {
    const typeScheme = { sentiment: 'neutral' as const, primary: COLORS.type, fill: COLORS.type, seriesColors: Object.values(COLORS) };
    charts.push({ type: typeMap.size > 1 ? 'donut' : 'bar', title: 'By Type', colorScheme: typeScheme, data: [...typeMap.entries()].map(([label, value]) => ({ label, value })) });
  }

  const journalMap = new Map<string, number>();
  for (const r of filtered) if (r.journal) journalMap.set(r.journal, (journalMap.get(r.journal) || 0) + 1);
  if (journalMap.size > 0) {
    charts.push({ type: 'bar', title: 'By Journal', yLabel: 'Count', colorScheme: scheme(COLORS.journal), data: [...journalMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([label, value]) => ({ label: label.substring(0, 22), value })) });
  }

  const yearMap = new Map<string, number>();
  for (const r of filtered) {
    if (r.published) { const y = r.published.substring(0, 4); if (/^\d{4}$/.test(y)) yearMap.set(y, (yearMap.get(y) || 0) + 1); }
  }
  if (yearMap.size > 0) {
    charts.push({ type: yearMap.size > 1 ? 'line' : 'bar', title: 'Timeline', yLabel: 'Papers', colorScheme: scheme(COLORS.year), data: [...yearMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([label, value]) => ({ label, value })) });
  }

  const authorMap = new Map<string, number>();
  for (const r of filtered) if (r.authors) for (const a of r.authors) authorMap.set(a, (authorMap.get(a) || 0) + 1);
  const topAuthors = [...authorMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  if (topAuthors.length > 0) {
    charts.push({ type: 'bar', title: 'Authors', yLabel: 'Papers', colorScheme: scheme(COLORS.author), data: topAuthors.map(([label, value]) => ({ label: label.substring(0, 20), value })) });
  }

  const pubMap = new Map<string, number>();
  for (const r of filtered) if ((r as any).publisher) pubMap.set((r as any).publisher, (pubMap.get((r as any).publisher) || 0) + 1);
  if (pubMap.size > 0) {
    charts.push({ type: 'bar', title: 'Publishers', yLabel: 'Count', colorScheme: scheme(COLORS.publisher), data: [...pubMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([label, value]) => ({ label: label.substring(0, 22), value })) });
  }

  return charts;
}

export function FilteredCharts({ matchingDois, totalDois }: { matchingDois: Set<string>; totalDois: number }) {
  const [records, setRecords] = useState<DoiRecord[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/records')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setRecords(data); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, []);

  const filtered = records.filter(r => matchingDois.has(r.doi));
  const isFiltered = matchingDois.size < totalDois;

  if (!loaded) return <div style={{ padding: 12, color: '#999', fontFamily: 'monospace', fontSize: 12 }}>Loading charts...</div>;
  if (!filtered.length) return <div style={{ padding: 12, color: '#999', fontFamily: 'monospace', fontSize: 12 }}>No matching papers for current selection.</div>;

  const charts = buildCharts(filtered);

  return (
    <div>
      {charts.length > 0 && <>
        <div style={{ fontSize: 11, color: '#666', fontFamily: 'monospace', marginBottom: 8 }}>
          {isFiltered ? `Charts for ${filtered.length} of ${totalDois} papers (filtered)` : `Charts for all ${filtered.length} papers`}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 8 }}>
          {charts.map((chart, i) => <ChartCard key={`${chart.title}-${filtered.length}-${i}`} chart={chart} />)}
        </div>
      </>}
      <FilteredPaperList papers={filtered} />
    </div>
  );
}
