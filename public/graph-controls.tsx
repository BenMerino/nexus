import React, { useState, useCallback, useRef } from 'react';
import type { Category } from './relationship-types';
import { COLORS, BG_COLORS } from './relationship-types';

/* ── Draggable Category Strip ──────────────────────────────── */

export function CategoryStrip({ categories, counts, active, onToggle, onReorder }: {
  categories: Category[];
  counts: Record<string, number>;
  active: Set<Category>;
  onToggle: (cat: Category) => void;
  onReorder: (from: number, to: number) => void;
}) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const dragRef = useRef<number | null>(null);

  const onDragStart = useCallback((e: React.DragEvent, idx: number) => {
    dragRef.current = idx; setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  }, []);
  const onDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOverIdx(idx);
  }, []);
  const onDrop = useCallback((e: React.DragEvent, toIdx: number) => {
    e.preventDefault();
    if (dragRef.current !== null && dragRef.current !== toIdx) onReorder(dragRef.current, toIdx);
    setDragIdx(null); setOverIdx(null); dragRef.current = null;
  }, [onReorder]);
  const onDragEnd = useCallback(() => { setDragIdx(null); setOverIdx(null); dragRef.current = null; }, []);

  const visible = categories.filter(c => (counts[c] || 0) > 0);
  const activeList = visible.filter(c => active.has(c));

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4, marginBottom: 12, flexWrap: 'wrap',
      padding: '6px 10px', background: '#f9f9fc', border: '1px solid #e8e8f0', borderRadius: 8,
    }}>
      <span style={{ fontSize: 10, color: '#999', fontFamily: 'monospace', marginRight: 2 }}>
        layout order
      </span>
      {visible.map((cat, i) => {
        const isActive = active.has(cat);
        const isDragging = dragIdx === i;
        const isOver = overIdx === i && dragIdx !== null && dragIdx !== i;
        const orderNum = isActive ? activeList.indexOf(cat) + 1 : null;
        return (
          <button key={cat} draggable onClick={() => onToggle(cat)}
            onDragStart={(e) => onDragStart(e, i)} onDragOver={(e) => onDragOver(e, i)}
            onDrop={(e) => onDrop(e, i)} onDragEnd={onDragEnd}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 999, cursor: 'grab',
              border: `1.5px solid ${isOver ? '#333' : isActive ? COLORS[cat] : '#ddd'}`,
              background: isActive ? BG_COLORS[cat] : '#fff',
              color: isActive ? COLORS[cat] : '#999',
              fontFamily: 'monospace', fontSize: 12,
              fontWeight: isActive ? 600 : 400,
              opacity: isDragging ? 0.4 : isActive ? 1 : 0.5,
              transition: 'border-color 100ms, opacity 100ms',
              userSelect: 'none',
              boxShadow: isOver ? '0 0 0 2px #333' : 'none',
            }}>
            <span style={{ color: isActive ? COLORS[cat] : '#ccc', fontSize: 10, letterSpacing: 1, lineHeight: 1 }}>
              ⠿
            </span>
            {orderNum !== null && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 18, height: 18, borderRadius: '50%', fontSize: 10, fontWeight: 700,
                background: COLORS[cat], color: '#fff',
              }}>{orderNum}</span>
            )}
            {cat}
            <span style={{ fontSize: 10, opacity: 0.7 }}>({counts[cat] || 0})</span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Tag Picker ─────────────────────────────────────────────── */

export function TagPicker({ category, tags, pinnedTags, pinnedOrder, onToggleTag }: {
  category: string;
  tags: { id: string; label: string; doiCount: number }[];
  pinnedTags: Set<string>;
  pinnedOrder: string[];
  onToggleTag: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasPins = tags.some(t => pinnedTags.has(t.id));
  const visible = tags.slice(0, expanded ? tags.length : 12);

  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: COLORS[category] }}>
          {category}
        </span>
        {hasPins && (
          <button onClick={() => { for (const t of tags) if (pinnedTags.has(t.id)) onToggleTag(t.id); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: '#999', fontFamily: 'monospace', padding: 0 }}>
            clear
          </button>
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        {visible.map(t => {
          const pinned = pinnedTags.has(t.id);
          return (
            <button key={t.id} onClick={() => onToggleTag(t.id)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                padding: '2px 7px', borderRadius: 3,
                border: `1px solid ${pinned ? COLORS[category] : '#e0e0e0'}`,
                background: pinned ? BG_COLORS[category] : '#fafafa',
                color: pinned ? COLORS[category] : '#666',
                cursor: 'pointer', fontFamily: 'monospace', fontSize: 10,
                fontWeight: pinned ? 600 : 400, transition: 'all 100ms ease',
                maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
              {t.label}
              <span style={{ fontSize: 9, opacity: 0.6 }}>{t.doiCount}</span>
            </button>
          );
        })}
        {tags.length > 12 && (
          <button onClick={() => setExpanded(p => !p)}
            style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: 3, cursor: 'pointer', fontSize: 10, color: '#999', fontFamily: 'monospace', padding: '2px 7px' }}>
            {expanded ? 'less' : `+${tags.length - 12}`}
          </button>
        )}
      </div>
    </div>
  );
}
