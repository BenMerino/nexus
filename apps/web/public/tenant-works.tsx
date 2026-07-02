import React, { useEffect, useState } from 'react';
import { ChartPanel } from './tenant-panel';
import { RichHtml } from './rich-text';
import { ES, typeLabelEs } from './tenant-i18n';

/* Publication lists for the tenant page: the corpus's most-cited papers and
 * its latest output, side by side. Plain server data (one /works fetch, unit-
 * scoped) rendered as rows — these are lists, not charts, so no directive. */

export interface PublicWork {
  doi: string | null; title: string | null; year: string | null;
  journal: string | null; type: string | null; citations: number;
}

function WorkRow({ w, showCites }: { w: PublicWork; showCites: boolean }) {
  return (
    <div className="work-item">
      <div className="work-title">
        {w.doi
          ? <a href={`https://doi.org/${w.doi}`} target="_blank" rel="noopener noreferrer"><RichHtml raw={w.title || '(untitled)'} /></a>
          : <RichHtml raw={w.title || '(untitled)'} />}
      </div>
      <div className="work-meta">
        {w.year && <span>{w.year}</span>}
        {w.journal && <span className="work-journal"><RichHtml raw={w.journal} /></span>}
        {w.type && <span>{typeLabelEs(w.type)}</span>}
        {showCites && <span className="work-cites">{w.citations.toLocaleString()} cit.</span>}
      </div>
    </div>
  );
}

function WorkList({ works, showCites }: { works: PublicWork[]; showCites: boolean }) {
  if (!works.length) return <div className="work-empty">{ES.works.empty}</div>;
  return <div>{works.map((w, i) => <WorkRow key={w.doi || i} w={w} showCites={showCites} />)}</div>;
}

export function TenantWorks({ slug, unit }: { slug: string; unit?: string | null }) {
  const [data, setData] = useState<{ topCited: PublicWork[]; recent: PublicWork[] } | null>(null);
  useEffect(() => {
    let cancelled = false;
    setData(null);
    const u = unit ? `?unit=${encodeURIComponent(unit)}` : '';
    fetch(`/api/public/${encodeURIComponent(slug)}/works${u}`)
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(d => { if (!cancelled) setData({ topCited: d.topCited || [], recent: d.recent || [] }); })
      .catch(() => { if (!cancelled) setData({ topCited: [], recent: [] }); });
    return () => { cancelled = true; };
  }, [slug, unit]);

  return (
    <div className="chart-grid reveal-group" style={{ marginTop: 24 }}>
      <ChartPanel title={ES.works.mostCited} sub={ES.works.mostCitedSub}>
        {data ? <WorkList works={data.topCited} showCites /> : <div style={{ minHeight: 200 }} />}
      </ChartPanel>
      <ChartPanel title={ES.works.recent} sub={ES.works.recentSub}>
        {data ? <WorkList works={data.recent} showCites={false} /> : <div style={{ minHeight: 200 }} />}
      </ChartPanel>
    </div>
  );
}
