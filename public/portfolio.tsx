import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Shell } from './shell';
import { Stat, Tag, SectionHead } from './ui-primitives';
import { VelocityPanel, type Velocity } from './portfolio-velocity';
import { CollaboratorsPanel, type Suggested } from './portfolio-collaborators';

type Work = { doi: string; title: string | null; year: string | null; citation_count: number | null };
type Portfolio = {
  researcher: { orcid: string; name: string | null; faculty: string | null; ror: string | null };
  works: Work[];
  velocity: Velocity;
  collaborators: { existing: string[]; suggested: Suggested[] };
};

function PortfolioContent({ data }: { data: Portfolio }) {
  const totalCitations = data.works.reduce((s, w) => s + (w.citation_count || 0), 0);
  const avgCit = data.works.length ? Math.round(totalCitations / data.works.length) : 0;
  const nameFirst = (data.researcher.name || data.researcher.orcid).split(' ')[0];

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <div className="eyebrow">Researcher portfolio</div>
          <h1 className="view-title">Your research, <em>{nameFirst}</em>.</h1>
          <div className="view-sub">Pulled from ORCID, OpenAlex, and CrossRef. Deduped, attributed, synced.</div>
        </div>
        <div className="view-meta">
          <Tag mono>ORCID {data.researcher.orcid}</Tag>
          {data.researcher.faculty && <Tag mono tone="muted">{data.researcher.faculty}</Tag>}
        </div>
      </header>

      <div className="stat-row">
        <Stat label="Publications" value={data.works.length} />
        <Stat label="Total citations" value={totalCitations.toLocaleString()} />
        <Stat label="Avg. per paper" value={avgCit} accent />
        <Stat label="Collaborators" value={data.collaborators.existing.length} />
      </div>

      <div className="dash-grid">
        <section className="card card-chart">
          <SectionHead eyebrow="Trajectory" title="Citation velocity" />
          <VelocityPanel velocity={data.velocity} />
        </section>
        <section className="card card-span-2">
          <SectionHead eyebrow="Missing link" title="Suggested collaborators" />
          <CollaboratorsPanel suggested={data.collaborators.suggested} />
        </section>
        <section className="card card-span-2">
          <SectionHead eyebrow="Ledger" title="Your publications" right={<Tag mono tone="muted">{data.works.length} total</Tag>} />
          <table className="paper-table">
            <thead>
              <tr><th>Title</th><th>Year</th><th>Citations</th></tr>
            </thead>
            <tbody>
              {data.works.slice(0, 40).map(w => (
                <tr key={w.doi}>
                  <td className="paper-title">{w.title || '(untitled)'}<div className="mono paper-doi">{w.doi}</div></td>
                  <td>{w.year || '—'}</td>
                  <td>{w.citation_count ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

function App() {
  const [data, setData] = useState<Portfolio | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orcid = params.get('orcid');
    const url = orcid ? `/api/portfolio?orcid=${encodeURIComponent(orcid)}` : '/api/portfolio';
    fetch(url).then(async r => {
      if (!r.ok) { setError((await r.json()).error || 'Failed to load'); return; }
      setData(await r.json());
    }).catch(e => setError(e.message));
  }, []);

  return (
    <Shell scroll>
      {error && <div className="view"><div className="status error">Error: {error}</div></div>}
      {!data && !error && <div className="view"><div className="eyebrow">Loading portfolio…</div></div>}
      {data && <PortfolioContent data={data} />}
    </Shell>
  );
}

const root = createRoot(document.getElementById('portfolio-root')!);
root.render(<App />);
