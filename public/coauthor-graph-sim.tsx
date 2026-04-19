import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Simulation } from 'd3-force';
import type { CoauthorGraph, CoauthorNode } from './dashboard-builders.js';
import { buildCommunityColors, majorRors, communityKeyFor } from './coauthor-communities';
import { GraphDefs, Links, Nodes, radius } from './coauthor-graph-render';
import { EgoLabel, HoverTooltip } from './coauthor-graph-labels';
import { CommunityHulls } from './coauthor-graph-hulls';
import { startDrag } from './coauthor-graph-drag';
import {
  initialNodes, initialLinks, buildAnchors, createSimulation,
  type SimN, type SimL,
} from './coauthor-graph-forces';

export function CoAuthorSim({ graph, width, height }: { graph: CoauthorGraph; width: number; height: number }) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const simRef = useRef<Simulation<SimN, SimL> | null>(null);
  const [, tick] = useState(0);
  const [hoverId, setHoverId] = useState<string | null>(null);

  const myRor = graph.nodes.find(n => n.isMe)?.affiliation?.ror || null;
  const communityColors = useMemo(() => buildCommunityColors(graph.nodes, myRor), [graph, myRor]);
  const major = useMemo(() => majorRors(graph.nodes, myRor), [graph, myRor]);

  const nodeColor = (n: CoauthorNode) => {
    if (n.isMe) return 'var(--accent)';
    const key = communityKeyFor(n, myRor, major);
    if (!key) return 'var(--fg-muted)';
    return communityColors.get(key) || 'var(--fg-dim)';
  };

  const { nodes, links } = useMemo(() => {
    const ns = initialNodes(graph.nodes, width, height);
    const ls = initialLinks(graph.edges, ns);
    return { nodes: ns, links: ls };
  }, [graph, width, height]);

  const anchors = useMemo(
    () => buildAnchors(nodes, myRor, width, height),
    [nodes, myRor, width, height],
  );

  useEffect(() => {
    const sim = createSimulation({
      nodes, links, anchors, myRor, width, height,
      onTick: () => tick(v => v + 1),
    });
    simRef.current = sim;
    return () => { sim.stop(); };
  }, [nodes, links, anchors, myRor, width, height]);

  const connected = useMemo(() => {
    if (!hoverId) return null;
    const set = new Set<string>([hoverId]);
    for (const l of links) {
      const s = typeof l.source === 'object' ? l.source.id : l.source;
      const t = typeof l.target === 'object' ? l.target.id : l.target;
      if (s === hoverId) set.add(t);
      if (t === hoverId) set.add(s);
    }
    return set;
  }, [hoverId, links]);

  const hovered = hoverId ? nodes.find(n => n.id === hoverId) : null;
  const me = nodes.find(n => n.isMe);

  const handleMouseDown = (e: React.MouseEvent, node: SimN) => {
    startDrag(e, node, svgRef.current!, simRef.current);
  };

  const handleClick = (node: SimN) => {
    window.location.href = `/overview.html?highlight=${encodeURIComponent(node.id)}`;
  };

  return (
    <div style={{ position: 'relative', width, height }}>
      <svg ref={svgRef} width={width} height={height} style={{ display: 'block', userSelect: 'none' }}>
        <GraphDefs />
        <CommunityHulls nodes={nodes} myRor={myRor} colors={communityColors} />
        <Links links={links} connected={connected} />
        <Nodes
          nodes={nodes}
          hoverId={hoverId}
          connected={connected}
          nodeColor={nodeColor}
          onHoverStart={setHoverId}
          onHoverEnd={() => setHoverId(null)}
          onMouseDown={handleMouseDown}
          onClick={handleClick}
        />
      </svg>
      {me && <EgoLabel me={me} radius={radius(me)} />}
      {hovered && !hovered.isMe && <HoverTooltip node={hovered} radius={radius(hovered)} />}
    </div>
  );
}
