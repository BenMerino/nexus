import { useEffect, useState } from 'react';
import type { CoauthorGraph } from './dashboard-builders.js';

/** Fetch the logged-in user's co-author graph from the dashboard stats API.
 *  Same data the dashboard's "Your co-author graph" panel uses. */
export function useCoauthorGraph(): CoauthorGraph | null {
  const [graph, setGraph] = useState<CoauthorGraph | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/dashboard?action=stats')
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(d => { if (!cancelled) setGraph(d.portfolio?.coauthorGraph ?? null); })
      .catch(() => { if (!cancelled) setGraph(null); });
    return () => { cancelled = true; };
  }, []);

  return graph;
}
