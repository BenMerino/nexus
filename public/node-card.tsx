import React from 'react';
import type { EnrichedSimNode } from './relationship-types';

export function NodeCard({ node, cColor, selected, hovered, expanded, dimmed, isJournal, handlers, style, onSelectPaper }: {
  node: EnrichedSimNode; cColor: string;
  selected: boolean; hovered: boolean; expanded: boolean; dimmed: boolean;
  isJournal: boolean; style: React.CSSProperties;
  handlers: { onClick: () => void; onMouseEnter: () => void; onMouseLeave: () => void };
  onSelectPaper?: (doi: string) => void;
}) {
  const papers = (isJournal && node.papers) ? node.papers : [];
  const open = hovered || expanded;
  const visiblePapers = papers.slice(0, 6);
  const cw = open ? 280 : (isJournal ? 160 : 220);
  const maxC = Math.floor(cw / 7.5);
  const trunc = node.label.length > maxC ? node.label.substring(0, maxC - 1) + '\u2026' : node.label;

  return (
    <div {...handlers} style={{
      ...style, width: cw, transform: 'translate(-50%, -50%)',
      boxSizing: 'border-box', cursor: isJournal ? 'pointer' : 'default',
      background: 'rgba(255,255,255,0.35)',
      backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      border: `1.5px solid ${cColor}`,
      borderRadius: 8, padding: '6px 0',
      boxShadow: open
        ? '0 8px 24px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.6)'
        : '0 2px 8px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.5)',
      opacity: dimmed ? 0.1 : 1,
      transition: 'opacity 200ms, box-shadow 300ms',
      fontFamily: 'monospace',
    }}>
      {/* Header — always visible */}
      <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#222', lineHeight: '16px', padding: '0 8px' }}>
        {trunc}
      </div>
      {isJournal && (
        <div style={{
          textAlign: 'center', fontSize: 10, color: cColor, marginTop: 2, fontWeight: 600,
          maxHeight: open ? 0 : 16, opacity: open ? 0 : 1, overflow: 'hidden',
          transition: 'max-height 250ms ease, opacity 200ms ease',
        }}>
          {papers.length} paper{papers.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* Expandable detail — always in DOM, animated via max-height */}
      <div style={{
        maxHeight: open ? 400 : 0, opacity: open ? 1 : 0, overflow: 'hidden',
        transition: 'max-height 300ms ease, opacity 250ms ease',
      }}>
        <div style={{ padding: '6px 12px 4px', borderTop: '1px solid rgba(0,0,0,0.06)', marginTop: 6 }}>
          {node.ext_id && (
            <div style={{ fontSize: 11, color: '#777', marginBottom: 5 }}>
              <span style={{ textTransform: 'uppercase', fontSize: 9, letterSpacing: 0.5, color: cColor, fontWeight: 700 }}>
                {node.group === 'journal' ? 'ISSN-L' : node.group === 'author' ? 'ORCID' : 'ROR'}
              </span>{' '}
              <span style={{ color: '#333' }}>{node.ext_id}</span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 12, fontSize: 11, marginBottom: 5 }}>
            <span><strong style={{ color: cColor, fontSize: 13 }}>{node.doiCount}</strong> <span style={{ color: '#888' }}>papers</span></span>
            <span><strong style={{ color: cColor, fontSize: 13 }}>{node.degree}</strong> <span style={{ color: '#888' }}>links</span></span>
          </div>
          {node.topKeywords && node.topKeywords.length > 0 && (
            <div style={{ fontSize: 11, color: '#666', fontStyle: 'italic' }}>{node.topKeywords.join(' \u00b7 ')}</div>
          )}
        </div>
        {visiblePapers.length > 0 && (
          <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', padding: '6px 0 2px', marginTop: 2 }}>
            <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5, color: cColor, fontWeight: 700, padding: '0 12px 4px' }}>Papers</div>
            {visiblePapers.map((p, i) => (
              <div key={i} onClick={(e) => { e.stopPropagation(); onSelectPaper?.(p.doi); }}
                style={{ fontSize: 11, color: '#444', lineHeight: '16px', padding: '3px 12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', borderBottom: '1px solid rgba(0,0,0,0.03)', cursor: 'pointer' }}
                onMouseOver={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; }}
                onMouseOut={e => { e.currentTarget.style.background = 'transparent'; }}>
                {p.title}
              </div>
            ))}
            {papers.length > 6 && (
              <div style={{ fontSize: 11, color: cColor, padding: '4px 12px', fontWeight: 600 }}>+{papers.length - 6} more</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
