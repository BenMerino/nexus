/**
 * Visual language — structural molecule backdrop.
 *
 * Renders a full-coverage molecule grid with no data — only dormant cells
 * filling the canvas. Used as a backdrop for chart cards, panel
 * surfaces, and other regions where the molecule's structural identity
 * should extend beyond just the data-bearing canvas.
 *
 * Sizing: the backdrop fills its parent via 100%/100% style. A
 * ResizeObserver tracks the parent's actual rendered dimensions and
 * sets the molecule grid accordingly (cell pitch from CELL_PITCH_PX).
 *
 * The backdrop has no `activeRegion` — every cell is structural, and
 * the grid is uniformly dormant. Data canvases that overlay on top
 * (the chart's actual chart-render canvas) provide the lit cells; the
 * backdrop fills the rest of the card.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useMoleculeCanvas, CELL_PITCH_PX, type BuildCells } from './index.js';

/** Empty cell builder — backdrop has no data, just structure. */
const emptyBuildCells: BuildCells = (_cols, _rows, out) => {
    out.fill(0);
};

export interface MoleculeBackdropProps {
    children?: React.ReactNode;
    /** Optional className for the wrapper. */
    className?: string;
    /** Optional inline style for the wrapper. */
    style?: React.CSSProperties;
}

export const MoleculeBackdrop: React.FC<MoleculeBackdropProps> = ({
    children, className, style,
}) => {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [size, setSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

    /* Track wrapper size; molecule canvas resizes to match. */
    useEffect(() => {
        const el = wrapperRef.current;
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
    }, []);

    const cols = Math.max(1, Math.floor(size.width / CELL_PITCH_PX));
    const rows = Math.max(1, Math.floor(size.height / CELL_PITCH_PX));

    useMoleculeCanvas(canvasRef, {
        cols, rows,
        cssWidth: size.width, cssHeight: size.height,
        buildCells: emptyBuildCells,
        deps: [],
    });

    return (
        <div
            ref={wrapperRef}
            className={className}
            style={{ position: 'relative', ...style }}
        >
            <canvas
                ref={canvasRef}
                style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                    zIndex: 0,
                    display: 'block',
                }}
            />
            <div style={{ position: 'relative', zIndex: 1 }}>
                {children}
            </div>
        </div>
    );
};
