import React, { useMemo } from 'react';
import type { EnrichedTagNode, ProjectedEdge } from './relationship-types';
type TagNode = EnrichedTagNode;
import { COLORS, BG_COLORS, communityColor, communityBg } from './relationship-types';

export function DetailPanel({
  node, connections, edgesForNode, onClose, onSelectNode,
}: {
  node: TagNode; connections: TagNode[]; edgesForNode: ProjectedEdge[];
  onClose: () => void; onSelectNode: (id: string) => void;
}) {
  const grouped = useMemo(() => {
    const g: Record<string, { node: TagNode; weight: number; dois: string[] }[]> = {};
    for (const c of connections) {
      const edge = edgesForNode.find(
        e => (e.source === node.id && e.target === c.id) || (e.target === node.id && e.source === c.id),
      );
      const entry = { node: c, weight: edge?.weight || 0, dois: edge?.sharedDois || [] };
      (g[c.group] ||= []).push(entry);
    }
    for (const k of Object.keys(g)) g[k].sort((a, b) => b.weight - a.weight);
    return g;
  }, [connections, edgesForNode, node.id]);

  const allDois = useMemo(() => {
    const set = new Set<string>();
    for (const e of edgesForNode) for (const d of e.sharedDois) set.add(d);
    return [...set];
  }, [edgesForNode]);

  return (
    <div style={{
      position: 'absolute', top: 12, right: 12, width: 320, maxHeight: 'calc(100% - 24px)',
      overflow: 'auto', background: 'rgba(255,255,255,0.5)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.6)', borderRadius: 8,
      padding: 16, fontFamily: 'monospace', fontSize: 13, boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <span style={{
            display: 'inline-block', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5,
            color: COLORS[node.group], background: BG_COLORS[node.group], padding: '2px 8px', borderRadius: 3, marginBottom: 4,
          }}>{node.group}</span>
          <span style={{
            display: 'inline-block', fontSize: 10, letterSpacing: 0.5, marginLeft: 4,
            color: communityColor(node.community), background: communityBg(node.community),
            padding: '2px 8px', borderRadius: 3, marginBottom: 4,
          }}>Community {node.community + 1}</span>
          <div style={{ fontWeight: 700, fontSize: 14, marginTop: 4, wordBreak: 'break-word' }}>{node.label}</div>
          <div style={{ fontSize: 11, color: '#999', marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span>weight: <strong style={{ color: COLORS[node.group] }}>{node.weight}</strong></span>
            <span>{node.degree} connection{node.degree !== 1 ? 's' : ''}</span>
            <span>{node.doiCount} paper{node.doiCount !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#999', padding: '0 4px', lineHeight: 1 }}>x</button>
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#666', marginBottom: 8, borderBottom: '1px solid #eee', paddingBottom: 4 }}>
        Connected tags ({connections.length})
      </div>
      {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([group, items]) => (
        <div key={group} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, color: COLORS[group], marginBottom: 3 }}>
            {group} ({items.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {items.slice(0, 25).map(({ node: item, weight }) => (
              <span key={item.id} onClick={() => onSelectNode(item.id)}
                title={`${weight} shared paper${weight !== 1 ? 's' : ''}`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: BG_COLORS[group], color: COLORS[group], padding: '2px 8px', borderRadius: 3,
                  fontSize: 11, cursor: 'pointer', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                {item.label}
                {weight > 1 && <span style={{ fontSize: 9, opacity: 0.7, fontWeight: 700 }}>{weight}</span>}
              </span>
            ))}
            {items.length > 25 && <span style={{ fontSize: 11, color: '#999' }}>+{items.length - 25} more</span>}
          </div>
        </div>
      ))}

      {allDois.length > 0 && (
        <div style={{ marginTop: 12, borderTop: '1px solid #eee', paddingTop: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#666', marginBottom: 6 }}>Papers ({allDois.length})</div>
          {allDois.slice(0, 15).map((d, i) => (
            <div key={i} style={{ fontSize: 11, color: '#555', padding: '2px 0', borderBottom: '1px solid #f5f5f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d}</div>
          ))}
          {allDois.length > 15 && <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>+{allDois.length - 15} more</div>}
        </div>
      )}
    </div>
  );
}
