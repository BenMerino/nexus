/**
 * Transparent SVG hit-test layer mounted above the GPU canvas.
 *
 * `ChartHitLayer` is the standalone version (its own <svg> root).
 * `ChartHitLayerInner` is the children-only version — used by ChartRender
 * which wraps with its own ref'd <svg> for tooltip-coord conversion.
 *
 * Renders one invisible target per primitive: actual shape for
 * polygon/polyline (so hit area matches the visible mark), bounding box
 * for rect/arc, enlarged circle for circles (so small dots are still
 * hoverable).
 */

import React from 'react';
import { primitiveBBox, type Primitive } from './chart-primitive.types.js';

export interface ChartHitLayerProps {
    primitives: ReadonlyArray<Primitive>;
    width: number;
    height: number;
    onHover?: (data: unknown, primitive: Primitive, e: React.MouseEvent<SVGElement>) => void;
    onLeave?: () => void;
    onClick?: (data: unknown, primitive: Primitive, e: React.MouseEvent<SVGElement>) => void;
}

export function ChartHitLayer(props: ChartHitLayerProps) {
    return (
        <svg
            viewBox={`0 0 ${props.width} ${props.height}`}
            width={props.width}
            height={props.height}
            style={{
                position: 'absolute', left: 0, top: 0,
                width: '100%', height: '100%',
                display: 'block',
            }}
            onMouseLeave={props.onLeave}
        >
            <ChartHitLayerInner {...props} />
        </svg>
    );
}

/** SVG path for an arc primitive — pie wedge when innerRadius=0, full
 *  annular ring otherwise. Used by the hit layer so click/hover only
 *  triggers when the pointer is over the actual wedge geometry, not
 *  the wedge's circular bounding box. */
function arcPath(p: Extract<Primitive, { kind: 'arc' }>): string {
    const sweep = Math.abs(p.endAngle - p.startAngle);
    const large = sweep > Math.PI ? 1 : 0;
    const c0x = p.cx + Math.cos(p.startAngle) * p.outerRadius;
    const c0y = p.cy + Math.sin(p.startAngle) * p.outerRadius;
    const c1x = p.cx + Math.cos(p.endAngle) * p.outerRadius;
    const c1y = p.cy + Math.sin(p.endAngle) * p.outerRadius;
    if (p.innerRadius <= 0) {
        /* Wedge: center → outer arc-start → outer arc-end → center. */
        return `M ${p.cx} ${p.cy} L ${c0x} ${c0y} A ${p.outerRadius} ${p.outerRadius} 0 ${large} 1 ${c1x} ${c1y} Z`;
    }
    /* Annular: outer arc → inner arc (reversed). */
    const i0x = p.cx + Math.cos(p.endAngle) * p.innerRadius;
    const i0y = p.cy + Math.sin(p.endAngle) * p.innerRadius;
    const i1x = p.cx + Math.cos(p.startAngle) * p.innerRadius;
    const i1y = p.cy + Math.sin(p.startAngle) * p.innerRadius;
    return `M ${c0x} ${c0y} A ${p.outerRadius} ${p.outerRadius} 0 ${large} 1 ${c1x} ${c1y} L ${i0x} ${i0y} A ${p.innerRadius} ${p.innerRadius} 0 ${large} 0 ${i1x} ${i1y} Z`;
}

const CURSOR_POINTER: React.CSSProperties = { cursor: 'pointer' };
const CURSOR_DEFAULT: React.CSSProperties = {};

export const ChartHitLayerInner = React.memo(function ChartHitLayerInner({ primitives, onHover, onClick }: ChartHitLayerProps) {
    const cursorStyle = onClick ? CURSOR_POINTER : CURSOR_DEFAULT;
    return (
        <>
            {primitives.map((p, i) => {
                if (p.data === undefined) return null;
                const handlers = {
                    onMouseEnter: onHover ? (e: React.MouseEvent<SVGElement>) => onHover(p.data, p, e) : undefined,
                    onClick: onClick ? (e: React.MouseEvent<SVGElement>) => onClick(p.data, p, e) : undefined,
                    style: cursorStyle,
                };
                if (p.kind === 'polygon') {
                    const pts = p.points.map(pt => `${pt.x},${pt.y}`).join(' ');
                    return <polygon key={i} points={pts} fill="transparent" pointerEvents="all" {...handlers} />;
                }
                if (p.kind === 'area-band') {
                    const topPts = p.top.map(pt => `${pt.x},${pt.y}`);
                    const basePts = typeof p.base === 'number'
                        ? p.top.map(pt => `${pt.x},${p.base as number}`).reverse()
                        : (p.base as ReadonlyArray<{ x: number; y: number }>)
                            .map(pt => `${pt.x},${pt.y}`).reverse();
                    const pts = [...topPts, ...basePts].join(' ');
                    return <polygon key={i} points={pts} fill="transparent" pointerEvents="all" {...handlers} />;
                }
                if (p.kind === 'polyline') {
                    const pts = p.points.map(pt => `${pt.x},${pt.y}`).join(' ');
                    return <polyline key={i} points={pts} fill="none" stroke="transparent"
                        strokeWidth={Math.max(p.strokeWidth, 8)} pointerEvents="stroke" {...handlers} />;
                }
                if (p.kind === 'circle') {
                    return <circle key={i} cx={p.cx} cy={p.cy} r={Math.max(p.r, 6)}
                        fill="transparent" pointerEvents="all" {...handlers} />;
                }
                if (p.kind === 'arc') {
                    /* Hit target traces the actual wedge/annulus path
                     * (not the bounding circle's full bbox, which would
                     * make every pie slice's hit area enormous). */
                    return <path key={i} d={arcPath(p)} fill="transparent"
                        pointerEvents="all" {...handlers} />;
                }
                /* rect: bbox. */
                const bb = primitiveBBox(p);
                return <rect key={i} x={bb.x} y={bb.y} width={bb.w} height={bb.h}
                    fill="transparent" pointerEvents="all" {...handlers} />;
            })}
        </>
    );
});
