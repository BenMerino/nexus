import { useEffect, useState } from 'react';
import type { RawNode, RawEdge } from './relationship-types';
import type { TagMetaMap } from './enrich-meta';

export interface GraphData {
  rawNodes: RawNode[];
  rawEdges: RawEdge[];
  tagMeta: TagMetaMap;
  loading: boolean;
}

export function useGraphData(): GraphData {
  const [rawNodes, setRawNodes] = useState<RawNode[]>([]);
  const [rawEdges, setRawEdges] = useState<RawEdge[]>([]);
  const [tagMeta, setTagMeta] = useState<TagMetaMap>({});
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch('/api/graph').then(r => r.json())
      .then((d: { nodes: RawNode[]; edges: RawEdge[] }) => {
        setRawNodes(d.nodes); setRawEdges(d.edges); setLoading(false);
      })
      .catch(() => setLoading(false));
    fetch('/api/graph-metadata').then(r => r.json())
      .then((d: { tagMeta: TagMetaMap }) => setTagMeta(d.tagMeta || {}))
      .catch(() => {});
  }, []);
  return { rawNodes, rawEdges, tagMeta, loading };
}
