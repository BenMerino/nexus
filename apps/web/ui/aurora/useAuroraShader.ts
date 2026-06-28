import { useEffect, useRef } from 'react';
import { compileShader, linkProgram, resolveColor } from '../visual-lang/index.js';
import { AURORA_VERT, AURORA_FRAG } from './aurora.shader.glsl.js';
import { type AuroraTuning } from './aurora.tuning.js';
import { buildPalette, type AuroraPalette } from './aurora.palettes.js';

const FULLSCREEN_TRI = new Float32Array([-1, -1, 3, -1, -1, 3]);
const MAX_BLOBS = 5;

/** Drives the aurora mesh-gradient on its own WebGL2 context. Unlike the
 *  particle molecules, this fills its CONTAINER (a button) — a ResizeObserver
 *  tracks the element so the canvas always matches the button's box. Each frame
 *  it builds the palette stops from the live theme (so the light/dark 2:1 ratio
 *  flips automatically) unless the caller passed explicit `tuning.colors`. */
export function useAuroraShader(
    canvasRef: React.RefObject<HTMLCanvasElement>,
    tuningRef: React.RefObject<AuroraTuning>,
    paletteRef: React.RefObject<AuroraPalette>,
) {
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const gl = canvas.getContext('webgl2', { alpha: false, antialias: true });
        if (!gl) { console.error('[aurora] no WebGL2'); return; }

        const vs = compileShader(gl, gl.VERTEX_SHADER, AURORA_VERT);
        const fs = compileShader(gl, gl.FRAGMENT_SHADER, AURORA_FRAG);
        if (!vs || !fs) return;
        const prog = linkProgram(gl, vs, fs);
        if (!prog) return;

        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, FULLSCREEN_TRI, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

        const u = (n: string) => gl.getUniformLocation(prog, n);
        const uTime = u('uTime'), uAspect = u('uAspect'), uSpeed = u('uSpeed');
        const uSoftness = u('uSoftness'), uCount = u('uCount');
        const uColors = u('uColors'), uSeeds = u('uSeeds');

        // Stable per-blob orbit phase seeds (deterministic, SSR-safe).
        const seeds = new Float32Array(MAX_BLOBS * 2);
        for (let i = 0; i < MAX_BLOBS; i++) {
            seeds[i * 2 + 0] = ((i * 2654435761) % 1000) / 1000;
            seeds[i * 2 + 1] = ((i * 40503 + 12345) % 1000) / 1000;
        }

        // Track the element's box so the canvas fills the button at any size.
        let cssW = canvas.clientWidth || 1, cssH = canvas.clientHeight || 1;
        const ro = new ResizeObserver((entries) => {
            const r = entries[0]?.contentRect;
            if (r) { cssW = Math.max(1, r.width); cssH = Math.max(1, r.height); }
        });
        ro.observe(canvas);

        const colorBuf = new Float32Array(MAX_BLOBS * 3);
        let cancelled = false;
        let raf = 0;
        const start = performance.now() / 1000;

        const tick = () => {
            if (cancelled) return;
            const t = tuningRef.current;
            const time = performance.now() / 1000 - start;

            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const w = Math.max(1, Math.round(cssW * dpr));
            const h = Math.max(1, Math.round(cssH * dpr));
            if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
            gl.viewport(0, 0, w, h);

            // Palette stops: explicit tuning.colors wins; otherwise generate
            // from the palette's base hue + shared axes, with the light/dark
            // 2:1 ratio flipped by the live theme (detected from <html>.dark).
            const isDark = typeof document !== 'undefined'
                && document.documentElement.classList.contains('dark');
            const stops = t.colors.length
                ? t.colors
                : buildPalette(paletteRef.current ?? 'primary', isDark);

            const count = Math.min(MAX_BLOBS, Math.max(2, stops.length));
            for (let i = 0; i < count; i++) {
                const c = resolveColor(stops[i]);
                colorBuf[i * 3 + 0] = c[0]; colorBuf[i * 3 + 1] = c[1]; colorBuf[i * 3 + 2] = c[2];
            }

            gl.useProgram(prog);
            gl.bindVertexArray(vao);
            gl.uniform1f(uTime, time);
            gl.uniform1f(uAspect, cssW / cssH);
            gl.uniform1f(uSpeed, t.speed);
            gl.uniform1f(uSoftness, t.softness);
            gl.uniform1i(uCount, count);
            gl.uniform3fv(uColors, colorBuf);
            gl.uniform2fv(uSeeds, seeds);
            gl.drawArrays(gl.TRIANGLES, 0, 3);

            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);

        return () => {
            cancelled = true;
            if (raf) cancelAnimationFrame(raf);
            ro.disconnect();
            gl.deleteProgram(prog);
            gl.deleteShader(vs); gl.deleteShader(fs);
            gl.deleteBuffer(buf); gl.deleteVertexArray(vao);
        };
    }, [canvasRef, tuningRef, paletteRef]);
}
