import React, { useEffect, useRef, useState } from 'react';
import './dna-liquid-demo.css';

/* Liquid-dom's canonical example ("Tiny glass"), ported from their demo/minimal
 * into our catalog — a real liquid-dom Scene: an HTML backdrop, one Glass panel
 * with HTML content inside, refracted by the WebGPU shader. Imperative
 * @liquid-dom/core API (Scene/Container/Glass/Html/Renderer), their exact config.
 *
 * Gated: renders only where HTML-in-Canvas is actually enabled; otherwise shows
 * the flag hint inline (never takes over the page). */

function flagEnabled(): boolean {
  if (typeof window === 'undefined' || !('gpu' in navigator)) return false;
  try {
    const ctx = document.createElement('canvas').getContext('2d') as
      (CanvasRenderingContext2D & { drawElement?: (el: Element, x: number, y: number) => void }) | null;
    if (!ctx || typeof ctx.drawElement !== 'function') return false;
    ctx.drawElement(document.createElement('div'), 0, 0);
    return true;
  } catch { return false; }
}

export function LiquidDomSection() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [enabled] = useState(flagEnabled);

  useEffect(() => {
    if (!enabled) return;
    const mount = stageRef.current;
    if (!mount) return;
    let cleanup = () => {};
    let frameId = 0;

    import('@liquid-dom/core').then(({ Scene, Container, Glass, Html, Renderer }) => {
      const scene = new Scene();

      const backdropEl = document.createElement('div');
      backdropEl.className = 'ld-backdrop';
      backdropEl.innerHTML =
        '<span class="ld-eyebrow">html backdrop</span><h2>Liquid glass</h2>' +
        '<p>Scene-level HTML sits behind one glass panel.</p>';
      const backdrop = scene.add(new Html({ zIndex: -1, element: backdropEl }));

      const container = new Container({
        x: 60, y: 70, blur: 9, spacing: 24, bezelWidth: 17, thickness: 86,
        contentDepth: 18, tint: { r: 0.12, g: 0.16, b: 0.18, a: 0.62 }, zIndex: 2,
      });
      const glass = new Glass({ width: 320, height: 170, cornerRadius: 44 });
      const contentEl = document.createElement('div');
      contentEl.className = 'ld-glass-content';
      contentEl.innerHTML =
        '<span>html inside glass</span><strong>Refracted content panel</strong>' +
        '<p>Real DOM, composited into the GPU texture and bent by the lens.</p>';
      glass.add(new Html({ width: 320, height: 170, element: contentEl }));
      container.add(glass);
      scene.add(container);

      const renderer = new Renderer({ scene });
      renderer.canvas.className = 'ld-canvas';
      mount.append(renderer.canvas);

      const sync = () => {
        const b = mount.getBoundingClientRect();
        backdrop.width = b.width; backdrop.height = b.height;
      };
      const ro = new ResizeObserver(sync); ro.observe(mount); sync();

      const frame = () => { renderer.render(); frameId = requestAnimationFrame(frame); };
      frame();
      cleanup = () => { cancelAnimationFrame(frameId); ro.disconnect(); renderer.destroy(); };
    }).catch(() => {});

    return () => cleanup();
  }, [enabled]);

  if (!enabled) {
    return (
      <div className="ld-flag-hint">
        <strong>liquid-dom needs Chrome's HTML-in-Canvas flag.</strong>
        <p>Enable <code>chrome://flags/#canvas-draw-element</code>, relaunch Chrome,
          and reload — this section will render liquid-dom's WebGPU glass. (The rest
          of the catalog uses our own glass and needs no flag.)</p>
      </div>
    );
  }
  return <div ref={stageRef} className="ld-stage" />;
}
