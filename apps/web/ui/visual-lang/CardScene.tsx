/**
 * Visual language — card-level molecule scene.
 *
 * One canvas per chart card. The canvas covers the entire card; the
 * card's chrome (title, toggles, chart axes, slider, legend) renders as
 * normal flex children on top with z-index. The chart's data lives
 * inside an `activeRegion` declared by the consumer — outside that
 * region, cells render structurally only (cheap path in the shader).
 *
 * Scene contract:
 *   - `cardRef`: the wrapper div the canvas should fill. ResizeObserver
 *     tracks its size; canvas resizes to match.
 *   - `buildCells`: writes the cell brightness array. Receives the cell
 *     grid dimensions (derived from card size + CELL_PITCH_PX).
 *   - `activeRegion`: declares where data may light up. Cells outside
 *     render only their structural identity.
 */

import { useEffect, useRef, useState, type RefObject } from 'react';
import { useMoleculeCanvas } from './use-molecule-canvas.js';
import { CELL_PITCH_PX } from './molecule-grid.js';
import type { BuildCells } from './use-molecule-canvas.js';
import type { ActiveRegion } from './molecule-grid.js';

export interface CardSceneProps {
    /** The card's wrapper element — the canvas fills this region. */
    cardRef: RefObject<HTMLElement | null>;
    /** Brightness mapper. Called with the card-sized cell grid. */
    buildCells: BuildCells;
    /** Where data may light up. Outside this region cells stay structural. */
    activeRegion: ActiveRegion;
    /** Re-run buildCells + draw when any of these change. */
    deps?: ReadonlyArray<unknown>;
}

/** Card-sized molecule canvas. Mounts a `<canvas>` positioned absolutely
 *  inside `cardRef`, sized to fill it via ResizeObserver. */
export function useCardScene({
    cardRef, buildCells, activeRegion, deps,
}: CardSceneProps): { canvasRef: RefObject<HTMLCanvasElement | null>; size: { width: number; height: number } } {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [size, setSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

    useEffect(() => {
        const el = cardRef.current;
        if (!el) return;
        const update = () => {
            const rect = el.getBoundingClientRect();
            setSize(prev => (
                prev.width === rect.width && prev.height === rect.height
                    ? prev
                    : { width: rect.width, height: rect.height }
            ));
        };
        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, [cardRef]);

    const cols = Math.max(1, Math.floor(size.width / CELL_PITCH_PX));
    const rows = Math.max(1, Math.floor(size.height / CELL_PITCH_PX));

    useMoleculeCanvas(canvasRef, {
        cols, rows,
        cssWidth: size.width, cssHeight: size.height,
        buildCells,
        activeRegion,
        deps: [buildCells, ...(deps ?? [])],
    });

    return { canvasRef, size };
}
