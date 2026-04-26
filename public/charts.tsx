import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { GraphRender } from '../graph-engine/index';
import { buildCharts } from './chart-builders';
import type { DoiRecord } from './chart-builders';

function App() {
  const [records, setRecords] = useState<DoiRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/records')
      .then(r => r.json())
      .then(data => { setRecords(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading...</div>;
  if (!records.length) return <div>No records. Submit some DOIs first.</div>;

  const charts = buildCharts(records);

  return (
    <div>
      {charts.map((chart, i) => (
        <div key={i} style={{ marginBottom: '1rem' }}>
          <GraphRender chart={chart} />
        </div>
      ))}
    </div>
  );
}

const root = createRoot(document.getElementById('chart-root')!);
root.render(<App />);
