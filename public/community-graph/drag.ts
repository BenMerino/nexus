import type { Simulation } from 'd3-force';

export type DragNode = { x: number; y: number; fx?: number | null; fy?: number | null };

export function startDrag<N extends DragNode, L>(
  e: React.MouseEvent,
  node: N,
  svg: SVGSVGElement,
  sim: Simulation<N, L> | null,
  pinAfterDrag: boolean,
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
    node.fx = p.x;
    node.fy = p.y;
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
