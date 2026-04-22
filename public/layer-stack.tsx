import React, { useCallback, useRef, useState } from 'react';
import { Check } from './ui-primitives';
import { COLORS } from './relationship-types';
import type { LayerType } from './explorer-layers';

interface Row {
  /** Z layer bucket — shared between rows that point at the same bucket. */
  layer: LayerType;
  /** State-key for the toggle (authors and co-authors share a layer but
   *  have independent visibility flags). */
  flagKey: string;
  label: string;
  color: string;
  checked: boolean;
  onToggle: (v: boolean) => void;
}

interface Props {
  rows: Row[];
  /** Current layer ordering, top (highest Z) first. */
  order: LayerType[];
  onReorder: (from: number, to: number) => void;
  /** Whether reorder is meaningful — shown as a disabled hint in 2D mode. */
  enabled: boolean;
}

/** The sidebar's Node-types section. Each row is a checkbox (visibility)
 *  plus a drag handle; dragging a row reorders the Z layers. Rows that
 *  share a layer (authors/co-authors) move as a group. */
export function LayerStack({ rows, order, onReorder, enabled }: Props) {
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

  // One visual entry per layer (collapsing rows that share a layer into a
  // single drag target), preserving the row order the parent passed in.
  const entries = order.map(layer => ({ layer, rows: rows.filter(r => r.layer === layer) }));

  return (
    <div className="layer-stack" data-enabled={enabled ? '1' : '0'}>
      {entries.map(({ layer, rows: layerRows }, i) => (
        <div
          key={layer}
          className="layer-stack-row"
          onDragOver={enabled ? e => onDragOver(e, i) : undefined}
          onDrop={enabled ? e => onDrop(e, i) : undefined}
          data-dragging={dragIdx === i ? '1' : '0'}
          data-over={overIdx === i && dragIdx !== null && dragIdx !== i ? '1' : '0'}
        >
          {enabled && (
            <span
              className="layer-stack-handle"
              draggable
              onDragStart={e => onDragStart(e, i)}
              onDragEnd={onDragEnd}
              title="Drag to reorder"
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

/** Canonical row set used by the explorer sidebar. Call-site fills in
 *  checked + onToggle from its flags state. */
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
