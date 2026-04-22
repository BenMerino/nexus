import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check } from './ui-primitives';
import { COLORS } from './relationship-types';
import type { LayerType } from './explorer-layers';

interface Row {
  layer: LayerType;
  flagKey: string;
  label: string;
  color: string;
  checked: boolean;
  onToggle: (v: boolean) => void;
}

interface Props {
  rows: Row[];
  order: LayerType[];
  onReorder: (from: number, to: number) => void;
  enabled: boolean;
}

/** The sidebar's Node-types section. Each row has a drag handle (⠿) that
 *  reorders the Z layers. Uses pointer events rather than HTML5 DnD so
 *  dragging a small <span> handle works reliably across browsers. */
export function LayerStack({ rows, order, onReorder, enabled }: Props) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dragStateRef = useRef<{ from: number; to: number } | null>(null);

  const entries = order.map(layer => ({ layer, rows: rows.filter(r => r.layer === layer) }));

  // Pointer-based drag: pick the row whose bounding rect vertically contains
  // the cursor. Simpler + more robust than HTML5 DnD on a tiny handle span.
  const pickRow = useCallback((clientY: number): number => {
    const rects = rowRefs.current.map(el => el?.getBoundingClientRect());
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      if (r && clientY >= r.top && clientY <= r.bottom) return i;
    }
    // Above the first or below the last — snap to the nearest end.
    const first = rects[0];
    if (first && clientY < first.top) return 0;
    return rects.length - 1;
  }, []);

  const startDrag = useCallback((e: React.PointerEvent, fromIdx: number) => {
    if (!enabled) return;
    e.preventDefault();
    setDragIdx(fromIdx);
    dragStateRef.current = { from: fromIdx, to: fromIdx };

    const onMove = (ev: PointerEvent) => {
      const to = pickRow(ev.clientY);
      dragStateRef.current = { from: fromIdx, to };
      setOverIdx(to);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      const s = dragStateRef.current;
      if (s && s.from !== s.to) onReorder(s.from, s.to);
      dragStateRef.current = null;
      setDragIdx(null);
      setOverIdx(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [enabled, onReorder, pickRow]);

  // Clear refs on row-count change so stale elements don't get hit-tested.
  useEffect(() => { rowRefs.current = rowRefs.current.slice(0, entries.length); }, [entries.length]);

  return (
    <div className="layer-stack" data-enabled={enabled ? '1' : '0'}>
      {entries.map(({ layer, rows: layerRows }, i) => (
        <div
          key={layer}
          ref={el => { rowRefs.current[i] = el; }}
          className="layer-stack-row"
          data-dragging={dragIdx === i ? '1' : '0'}
          data-over={overIdx === i && dragIdx !== null && dragIdx !== i ? '1' : '0'}
        >
          {enabled && (
            <span
              className="layer-stack-handle"
              onPointerDown={e => startDrag(e, i)}
              title="Drag to reorder layers"
            >⠿</span>
          )}
          <div className="layer-stack-checks">
            {layerRows.map(r => (
              <Check key={r.flagKey} checked={r.checked} onChange={r.onToggle} label={r.label} color={r.color} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function buildLayerRows(
  flags: { institution: boolean; author: boolean; coauthor: boolean; journal: boolean; paper: boolean },
  setFlag: (k: 'institution' | 'author' | 'coauthor' | 'journal' | 'paper', v: boolean) => void,
): Row[] {
  const paperColor = '#888';
  return [
    { layer: 'institution', flagKey: 'institution', label: 'Institutions', color: COLORS.institution, checked: flags.institution, onToggle: v => setFlag('institution', v) },
    { layer: 'author',      flagKey: 'author',      label: 'Authors',      color: COLORS.author,      checked: flags.author,      onToggle: v => setFlag('author', v) },
    { layer: 'author',      flagKey: 'coauthor',    label: 'Co-authors',   color: COLORS.author,      checked: flags.coauthor,    onToggle: v => setFlag('coauthor', v) },
    { layer: 'journal',     flagKey: 'journal',     label: 'Journals',     color: COLORS.journal,     checked: flags.journal,     onToggle: v => setFlag('journal', v) },
    { layer: 'paper',       flagKey: 'paper',       label: 'Papers',       color: paperColor,         checked: flags.paper,       onToggle: v => setFlag('paper', v) },
  ];
}
