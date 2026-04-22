import type { Simulation } from 'd3-force';

export type DragNode = { x: number; y: number; z?: number; fx?: number | null; fy?: number | null };

/** Matches projection.ts — kept local so drag can un-project cursor coords
 *  back to the logical (x, y) plane where d3-force operates. */
const DX = 0.35;
const DY = 0.75;

export function startDrag<N extends DragNode, L>(
  e: React.MouseEvent,
  node: N,
  svg: SVGSVGElement,
  sim: Simulation<N, L> | null,
  pinAfterDrag: boolean,
  getTilt: () => number = () => 0,
) {
  e.preventDefault();
  e.stopPropagation();
  const pt = svg.createSVGPoint();
  node.fx = node.x;
  node.fy = node.y;
  sim?.alphaTarget(0.3).restart();

  const onMove = (ev: MouseEvent) => {
    pt.x = ev.clientX;
    pt.y = ev.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    const tilt = getTilt();
    const z = node.z ?? 0;
    node.fx = p.x - z * DX * tilt;
    node.fy = p.y + z * DY * tilt;
  };
  const onUp = () => {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    sim?.alphaTarget(0);
    if (!pinAfterDrag) {
      node.fx = null;
      node.fy = null;
    }
  };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}
