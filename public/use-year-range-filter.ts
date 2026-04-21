import { useState, useEffect, useMemo } from 'react';
import { useTimeRange } from './time-slider';

interface RawNode { id: string; group: string; published?: string | null }
interface RawEdge { source: string; target: string }

function yearOf(n: RawNode): number {
  if (n.group !== 'doi' || !n.published) return 0;
  const y = parseInt(n.published.substring(0, 4));
  return y > 1900 ? y : 0;
}

export function useYearRangeFilter<N extends RawNode, E extends RawEdge>(rawNodes: N[], rawEdges: E[]) {
  const { min: yearMin, max: yearMax } = useTimeRange(rawNodes);
  const [range, setRange] = useState<[number, number] | null>(null);
  useEffect(() => { if (yearMin && yearMax && !range) setRange([yearMin, yearMax]); }, [yearMin, yearMax, range]);

  const yearFrom = range ? range[0] : yearMin;
  const yearTo = range ? range[1] : yearMax;

  const filteredRaw = useMemo(() => {
    const fullSpan = yearFrom <= yearMin && yearTo >= yearMax;
    if (fullSpan) return { nodes: rawNodes, edges: rawEdges };
    const keep = new Set<string>();
    const nodes = rawNodes.filter(n => {
      if (n.group !== 'doi') return true;
      const y = yearOf(n); const ok = !y || (y >= yearFrom && y <= yearTo);
      if (ok) keep.add(n.id); return ok;
    });
    const edges = rawEdges.filter(e => !e.source.startsWith('doi:') || keep.has(e.source));
    return { nodes, edges };
  }, [rawNodes, rawEdges, yearFrom, yearTo, yearMin, yearMax]);

  return { yearMin, yearMax, yearFrom, yearTo, setRange, filteredRaw };
}
