import React, { useMemo } from 'react';
import { BaseAction } from '../ui/primitives';
import type { EnrichedTagNode, ProjectedEdge } from './relationship-types';
import { COLORS, BG_COLORS, communityColor, communityBg } from './relationship-types';

type TagNode = EnrichedTagNode;

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
    <div className="detail-panel" style={{
      position: 'absolute', top: 12, right: 12, width: 320, maxHeight: 'calc(100% - 24px)',
      padding: 20, fontSize: 'var(--text-detail)',
    }}>
      <div className="detail-head" style={{ paddingBottom: 14 }}>
        <div>
          <span className="tag mono" style={{ color: COLORS[node.group], background: BG_COLORS[node.group], marginRight: 4 }}>{node.group}</span>
          <span className="tag mono" style={{ color: communityColor(node.community), background: communityBg(node.community) }}>Community {node.community + 1}</span>
          <h3 style={{ marginTop: 8, wordBreak: 'break-word' }}>{node.label}</h3>
          <div style={{ fontSize: 'var(--text-micro)', color: 'var(--fg-dim)', marginTop: 6, display: 'flex', gap: 10, flexWrap: 'wrap', fontFamily: 'var(--mono)' }}>
            <span>weight: <strong style={{ color: COLORS[node.group] }}>{node.weight}</strong></span>
            <span>{node.degree} connection{node.degree !== 1 ? 's' : ''}</span>
            <span>{node.doiCount} paper{node.doiCount !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <BaseAction variant="ghost" iconOnly className="close" aria-label="Close" onClick={onClose}>×</BaseAction>
      </div>

      <div className="detail-section-label">Connected tags ({connections.length})</div>
      {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([group, items]) => (
        <div key={group} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 'var(--text-micro)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 'var(--weight-label)', color: COLORS[group], marginBottom: 4, fontFamily: 'var(--mono)' }}>
            {group} ({items.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {items.slice(0, 25).map(({ node: item, weight }) => (
              <span key={item.id} onClick={() => onSelectNode(item.id)}
                title={`${weight} shared paper${weight !== 1 ? 's' : ''}`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: BG_COLORS[group], color: COLORS[group], padding: '2px 8px', borderRadius: 3,
                  fontSize: 'var(--text-micro)', cursor: 'pointer', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                {item.label}
                {weight > 1 && <span style={{ fontSize: 'var(--text-micro)', opacity: 0.75, fontWeight: 'var(--weight-label)' }}>{weight}</span>}
              </span>
            ))}
            {items.length > 25 && <span style={{ fontSize: 'var(--text-micro)', color: 'var(--fg-dim)' }}>+{items.length - 25} more</span>}
          </div>
        </div>
      ))}

      {allDois.length > 0 && (
        <div style={{ marginTop: 14, borderTop: '1px solid var(--border-soft)', paddingTop: 10 }}>
          <div className="detail-section-label">Papers ({allDois.length})</div>
          {allDois.slice(0, 15).map((d, i) => (
            <div key={i} style={{ fontSize: 'var(--text-micro)', color: 'var(--fg-muted)', padding: '3px 0', borderBottom: '1px solid var(--border-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--mono)' }}>{d}</div>
          ))}
          {allDois.length > 15 && <div style={{ fontSize: 'var(--text-micro)', color: 'var(--fg-dim)', marginTop: 6 }}>+{allDois.length - 15} more</div>}
        </div>
      )}
    </div>
  );
}
