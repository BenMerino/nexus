import React, { useState, useCallback, useRef } from 'react';
import type { Category } from './relationship-types';
import { COLORS, BG_COLORS } from './relationship-types';
import { BaseAction } from '../ui/primitives';

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
      padding: '8px 12px', background: 'var(--bg-card)', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius)',
    }}>
      <span style={{ fontSize: 10, color: 'var(--fg-dim)', fontFamily: 'var(--mono)', marginRight: 2, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        layout order
      </span>
      {visible.map((cat, i) => {
        const isActive = active.has(cat);
        const isDragging = dragIdx === i;
        const isOver = overIdx === i && dragIdx !== null && dragIdx !== i;
        const orderNum = isActive ? activeList.indexOf(cat) + 1 : null;
        return (
          <BaseAction key={cat} draggable size="sm" variant={isActive ? 'primary' : 'outline'}
            aria-pressed={isActive} onClick={() => onToggle(cat)}
            onDragStart={(e) => onDragStart(e, i)} onDragOver={(e) => onDragOver(e, i)}
            onDrop={(e) => onDrop(e, i)} onDragEnd={onDragEnd}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 999, cursor: 'grab',
              border: `1.5px solid ${isOver ? 'var(--accent)' : isActive ? COLORS[cat] : 'var(--border)'}`,
              background: isActive ? BG_COLORS[cat] : 'var(--bg-inset)',
              color: isActive ? COLORS[cat] : 'var(--fg-dim)',
              fontFamily: 'var(--mono)', fontSize: 12,
              fontWeight: isActive ? 500 : 400,
              opacity: isDragging ? 0.4 : isActive ? 1 : 0.6,
              transition: 'border-color 100ms, opacity 100ms',
              userSelect: 'none',
              boxShadow: isOver ? '0 0 0 2px var(--accent)' : 'none',
            }}>
            <span style={{ color: isActive ? COLORS[cat] : 'var(--fg-dim)', fontSize: 10, letterSpacing: 1, lineHeight: 1 }}>
              ⠿
            </span>
            {orderNum !== null && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 18, height: 18, borderRadius: '50%', fontSize: 10, fontWeight: 500,
                background: COLORS[cat], color: '#1a1612',
              }}>{orderNum}</span>
            )}
            {cat}
            <span style={{ fontSize: 10, opacity: 0.7 }}>({counts[cat] || 0})</span>
          </BaseAction>
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
          <BaseAction variant="secondary" size="sm" onClick={() => { for (const t of tags) if (pinnedTags.has(t.id)) onToggleTag(t.id); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: 'var(--fg-dim)', fontFamily: 'var(--mono)', padding: 0 }}>
            clear
          </BaseAction>
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        {visible.map(t => {
          const pinned = pinnedTags.has(t.id);
          return (
            <BaseAction key={t.id} size="sm" variant={pinned ? 'primary' : 'outline'}
              aria-pressed={pinned} onClick={() => onToggleTag(t.id)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                padding: '2px 7px', borderRadius: 3,
                border: `1px solid ${pinned ? COLORS[category] : 'var(--border-soft)'}`,
                background: pinned ? BG_COLORS[category] : 'var(--bg-inset)',
                color: pinned ? COLORS[category] : 'var(--fg-muted)',
                cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 10,
                fontWeight: pinned ? 500 : 400, transition: 'all 100ms ease',
                maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
              {t.label}
              <span style={{ fontSize: 9, opacity: 0.65 }}>{t.doiCount}</span>
            </BaseAction>
          );
        })}
        {tags.length > 12 && (
          <BaseAction size="sm" variant={expanded ? 'primary' : 'outline'} aria-pressed={expanded} onClick={() => setExpanded(p => !p)}
            style={{ background: 'transparent', border: '1px solid var(--border-soft)', borderRadius: 3, cursor: 'pointer', fontSize: 10, color: 'var(--fg-dim)', fontFamily: 'var(--mono)', padding: '2px 7px' }}>
            {expanded ? 'less' : `+${tags.length - 12}`}
          </BaseAction>
        )}
      </div>
    </div>
  );
}
