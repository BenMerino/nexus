import React, { useMemo } from 'react';
import type { CoauthorGraph, CoauthorNode, CoauthorEdge } from './dashboard-builders.js';
import { CommunityGraph, type CommunityAdapter } from './community-graph';

function radius(n: CoauthorNode) {
  return n.isMe ? 12 : 5 + Math.min(10, Math.sqrt(n.weight) * 1.5);
}

interface CoAuthorSimProps {
  graph: CoauthorGraph;
  width: number;
  height: number;
  onNodeClick?: (n: CoauthorNode) => void;
}

export function CoAuthorSim({ graph, width, height, onNodeClick }: CoAuthorSimProps) {
  const myRor = graph.nodes.find(n => n.isMe)?.affiliation?.ror || null;

  const adapter = useMemo<CommunityAdapter<CoauthorNode>>(() => ({
    getId: n => n.id,
    getLabel: n => n.label,
    getRadius: radius,
    getCommunityKey: n => n.affiliation?.ror ?? null,
    isEgo: n => !!n.isMe,
    getCommunityLabel: (_key, sample) => sample.affiliation?.name || _key,
    getHoverSubtitle: n => n.affiliation?.name || null,
    getHoverFootnote: n => `${n.weight} shared ${n.weight === 1 ? 'paper' : 'papers'}`,
  }), []);

  return (
    <CommunityGraph<CoauthorNode, CoauthorEdge>
      nodes={graph.nodes}
      links={graph.edges}
      adapter={adapter}
      primaryKey={myRor}
      width={width}
      height={height}
      onNodeClick={onNodeClick ?? (n => { window.location.href = `/overview.html?highlight=${encodeURIComponent(n.id)}`; })}
    />
  );
}
