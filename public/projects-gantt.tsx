import React, { useEffect, useMemo, useState } from 'react';
import { SectionHead } from './ui-primitives';

interface Investigator { rol: string; full_name: string; orcid?: string | null; user_id?: number | null; }
interface Project {
  id: number; titulo: string; fuente_financiamiento?: string | null;
  concursable: boolean; externo: boolean; monto?: number | null;
  fecha_inicio?: string | null; fecha_fin?: string | null;
  codigo?: string | null; departamento?: string | null;
  investigators?: Investigator[];
}

const MS_DAY = 86400000;

function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(String(s).slice(0, 10));
  return isNaN(d.getTime()) ? null : d;
}

function fmtYear(d: Date): string {
  return String(d.getFullYear());
}

function fmtCLP(n: number | null | undefined): string {
  if (!n) return '$0';
  return '$' + Number(n).toLocaleString('es-CL');
}

export function ProjectsGanttPanel({ filterOrcid }: { filterOrcid?: string | null }) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/projects?action=list')
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(setProjects)
      .catch(e => setErr(String(e)));
  }, []);

  const filtered = useMemo(() => {
    if (!projects) return [];
    let rows = projects.filter(p => parseDate(p.fecha_inicio) && parseDate(p.fecha_fin));
    if (filterOrcid) {
      rows = rows.filter(p => (p.investigators || []).some(i => i.orcid === filterOrcid));
    }
    return rows.sort((a, b) => {
      const ai = parseDate(a.fecha_inicio)!.getTime();
      const bi = parseDate(b.fecha_inicio)!.getTime();
      return ai - bi;
    });
  }, [projects, filterOrcid]);

  const range = useMemo(() => {
    if (!filtered.length) return null;
    let min = Infinity, max = -Infinity;
    for (const p of filtered) {
      const s = parseDate(p.fecha_inicio)!.getTime();
      const e = parseDate(p.fecha_fin)!.getTime();
      if (s < min) min = s;
      if (e > max) max = e;
    }
    const start = new Date(min); start.setMonth(0, 1);
    const end = new Date(max); end.setFullYear(end.getFullYear() + 1, 0, 1);
    return { start, end };
  }, [filtered]);

  if (err) return <section className="card card-span-4"><SectionHead title="Proyectos" /><div className="muted">Error: {err}</div></section>;
  if (!projects) return <section className="card card-span-4"><SectionHead title="Proyectos" /><div className="muted skel" style={{ height: 200 }} /></section>;
  if (!filtered.length) return <section className="card card-span-4"><SectionHead title="Proyectos" /><div className="muted">Sin proyectos con fechas registradas.</div></section>;

  const totalMs = range!.end.getTime() - range!.start.getTime();
  const todayMs = Date.now();
  const todayPct = totalMs > 0 ? ((todayMs - range!.start.getTime()) / totalMs) * 100 : -1;

  const ticks: { pct: number; label: string }[] = [];
  const cursor = new Date(range!.start);
  while (cursor < range!.end) {
    const pct = ((cursor.getTime() - range!.start.getTime()) / totalMs) * 100;
    ticks.push({ pct, label: fmtYear(cursor) });
    cursor.setFullYear(cursor.getFullYear() + 1);
  }

  return (
    <section className="card card-span-4 gantt-card">
      <SectionHead title="Proyectos" />
      <div className="gantt-wrap">
        <div className="gantt-axis">
          {ticks.map((t, i) => (
            <div key={i} className="gantt-tick" style={{ left: t.pct + '%' }}>
              <span className="gantt-tick-label">{t.label}</span>
            </div>
          ))}
        </div>
        <div className="gantt-rows">
          {todayPct >= 0 && todayPct <= 100 && (
            <div className="gantt-today" style={{ left: todayPct + '%' }} title="Hoy" />
          )}
          {filtered.map(p => {
            const s = parseDate(p.fecha_inicio)!.getTime();
            const e = parseDate(p.fecha_fin)!.getTime();
            const left = ((s - range!.start.getTime()) / totalMs) * 100;
            const width = Math.max(((e - s) / totalMs) * 100, 0.5);
            const meIsIR = filterOrcid
              ? (p.investigators || []).some(i => i.rol === 'IR' && i.orcid === filterOrcid)
              : false;
            const cls = filterOrcid
              ? (meIsIR ? 'gantt-bar gantt-bar-ir' : 'gantt-bar gantt-bar-co')
              : 'gantt-bar gantt-bar-neutral';
            const fundLabel = p.fuente_financiamiento || 'Otro';
            return (
              <div key={p.id} className="gantt-row">
                <div className="gantt-row-label" title={fundLabel}>
                  <span className="gantt-title">{fundLabel}</span>
                </div>
                <div className="gantt-track">
                  <div className={cls} style={{ left: left + '%', width: width + '%' }} title={`${p.titulo}\n${p.fecha_inicio?.slice(0,10)} → ${p.fecha_fin?.slice(0,10)}\n${fmtCLP(p.monto)}`}>
                    <span className="gantt-bar-label">{p.titulo}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="gantt-legend">
        {filterOrcid ? (
          <>
            <span><i className="legend-dot ir" />Investigador responsable</span>
            <span><i className="legend-dot co" />Co-investigador</span>
          </>
        ) : (
          <span><i className="legend-dot neutral" />Proyecto</span>
        )}
        <span><i className="legend-line" />Hoy</span>
      </div>
    </section>
  );
}
