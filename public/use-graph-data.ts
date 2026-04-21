import { useEffect, useState } from 'react';
import type { RawNode, RawEdge } from './relationship-types';
import type { TagMetaMap } from './enrich-meta';

export interface AuthorAffiliationsMap {
  /** authorNodeId → institutionNodeId → paper count, from doi_records.authors JSON. */
  byAuthor: Record<string, Record<string, number>>;
}

export interface GraphData {
  rawNodes: RawNode[];
  rawEdges: RawEdge[];
  affiliations: AuthorAffiliationsMap;
  tagMeta: TagMetaMap;
  loading: boolean;
}

const EMPTY_AFFS: AuthorAffiliationsMap = { byAuthor: {} };

export function useGraphData(): GraphData {
  const [rawNodes, setRawNodes] = useState<RawNode[]>([]);
  const [rawEdges, setRawEdges] = useState<RawEdge[]>([]);
  const [affiliations, setAffiliations] = useState<AuthorAffiliationsMap>(EMPTY_AFFS);
  const [tagMeta, setTagMeta] = useState<TagMetaMap>({});
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch('/api/graph').then(r => r.json())
      .then((d: { nodes: RawNode[]; edges: RawEdge[]; affiliations?: AuthorAffiliationsMap }) => {
        setRawNodes(d.nodes); setRawEdges(d.edges);
        setAffiliations(d.affiliations || EMPTY_AFFS);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    fetch('/api/graph-metadata').then(r => r.json())
      .then((d: { tagMeta: TagMetaMap }) => setTagMeta(d.tagMeta || {}))
      .catch(() => {});
  }, []);
  return { rawNodes, rawEdges, affiliations, tagMeta, loading };
}
