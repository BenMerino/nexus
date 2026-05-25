/**
 * Visual language — React hook that renders a MoleculeGrid surface.
 *
 * Uses the shared renderer (WebGPU when available, WebGL2 otherwise) —
 * one offscreen context for the whole page to stay under per-page GPU
 * context caps. The consumer's visible canvas uses `bitmaprenderer` and
 * receives a transferred ImageBitmap per frame.
 *
 * Two-effect lifecycle:
 *   - Mount effect: acquires the visible canvas's `bitmaprenderer` ctx.
 *   - Render effect: awaits the shared renderer, then runs an rAF loop
 *     that lerps cell-target into cell-current and asks the renderer to
 *     draw + transfer the bitmap each frame.
 *
 * Consumer provides: a `buildCells` function that fills the cell array
 * given the grid dimensions, plus the render parameters. Charts express
 * only their brightness mapping — the foundation handles everything else.
 */

import { useEffect, useRef, type RefObject } from 'react';
import {
    acquireSharedRenderer,
    type SharedRenderer,
    type ActiveRegion,
} from './shared-renderer.js';

/** Build the cell brightness array for one render pass. Implementation
 *  fills `out` with cols*rows*4 floats: [r, g, b, lit] per cell, gy=0 at
 *  the visual bottom (matches the molecule's bottom-up convention). */
export type BuildCells = (cols: number, rows: number, out: Float32Array) => void;

export interface UseMoleculeCanvasOpts {
    cols: number;
    rows: number;
    cssWidth: number;
    cssHeight: number;
    glow?: number;
    iridescence?: number;
    overflow?: number;
    moleculeTime?: number;
    density?: number;
    /** Cell-value smoother time constant in seconds. Larger = slower
     * transitions on data updates, hover, slider drags. Falls back to
     * CELL_TAU_SECONDS (engine default) when omitted. */
    cellTau?: number;
    /** Dormant body brightness uniform [0..1]. Falls back to the shader's
     * default when omitted. */
    dormantBrightness?: number;
    /** Dormant grey overlay alpha multiplier [0..1]. Falls back to the
     * shader's default when omitted. */
    dormantGreyAlpha?: number;
    /** Active region: where data may light cells. Cells outside still
     *  render as dormant structure. Defaults to full canvas. */
    activeRegion?: ActiveRegion;
    buildCells: BuildCells;
    /** Re-run cell upload + draw when any of these change. The hook also
     *  re-runs on cols/rows/cssWidth/cssHeight changes implicitly. */
    deps?: ReadonlyArray<unknown>;
}

interface LocalState {
    bitmapCtx: ImageBitmapRenderingContext;
    /** Target: what buildCells most recently produced. */
    cellTarget: Float32Array;
    /** Current: lerped toward cellTarget each frame. This is what gets
     * uploaded to the GL texture. Decoupling target from current makes
     * size/glow transitions smooth instead of snapping. */
    cellCur: Float32Array;
    cellArrCols: number;
    cellArrRows: number;
    /** Active rAF id while a transition is in flight; null when static. */
    raf: number | null;
    /** Wall-clock of last frame, for dt-based easing. */
    lastFrameMs: number;
}

/** Time constant of the cell-value smoother. dt-based easing means the
 * speed of growth/decay is FPS-independent and matches the loader's
 * feel. The loader uses 0.4s — same constant here so chart cell pulses
 * and data transitions read identically to the loader's "alive but
 * unhurried" character. The smoother is what makes a cell shrink at
 * its old position while another cell grows at its new position when
 * data shifts: the two tau-eases happen concurrently, reading as a
 * single morphing pulse. */
const CELL_TAU_SECONDS = 0.4;
/** Threshold below which we consider current ≈ target and stop the rAF
 * loop. Avoids endless near-zero diffs from rounding. */
const CONVERGE_EPS = 0.002;

export function useMoleculeCanvas(
    canvasRef: RefObject<HTMLCanvasElement | null>,
    opts: UseMoleculeCanvasOpts,
): void {
    const optsRef = useRef(opts);
    optsRef.current = opts;
    const stateRef = useRef<LocalState | null>(null);

    /* Mount: acquire bitmaprenderer context on the visible canvas.
     * No GPU acquisition here — the shared renderer owns the only
     * GPU/WebGL context on the page. */
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const bitmapCtx = canvas.getContext('bitmaprenderer');
        if (!bitmapCtx) return;
        stateRef.current = {
            bitmapCtx,
            cellTarget: new Float32Array(0),
            cellCur: new Float32Array(0),
            cellArrCols: 0,
            cellArrRows: 0,
            raf: null,
            lastFrameMs: 0,
        };
        return () => {
            const s = stateRef.current;
            if (s?.raf != null) cancelAnimationFrame(s.raf);
            stateRef.current = null;
        };
    }, [canvasRef]);

    /* Render: rebuild target cell array, then run a smoother rAF loop
     * that lerps `cellCur` toward `cellTarget` and uploads each frame
     * until convergence. Mirrors the loader's tau-based easing so chart
     * cell pulses (hover highlight, data updates) grow/glow smoothly
     * instead of snapping on/off. */
    useEffect(() => {
        const state = stateRef.current;
        const canvas = canvasRef.current;
        if (!state || !canvas) return;

        if (state.cellArrCols !== opts.cols || state.cellArrRows !== opts.rows) {
            state.cellTarget = new Float32Array(opts.cols * opts.rows * 4);
            state.cellCur = new Float32Array(opts.cols * opts.rows * 4);
            state.cellArrCols = opts.cols;
            state.cellArrRows = opts.rows;
        }

        let cancelled = false;
        let renderer: SharedRenderer | null = null;

        const renderFrame = (nowMs: number) => {
            const s = stateRef.current;
            const c = canvasRef.current;
            if (!s || !c || !renderer || cancelled) return;
            const cur = optsRef.current;
            cur.buildCells(cur.cols, cur.rows, s.cellTarget);

            /* dt = 0 on the very first frame after the loop kicks. Treat
             * it as a redraw-current-state pass — do NOT lerp, otherwise
             * alpha=1 would snap cellCur → target and skip the transition. */
            const dt = s.lastFrameMs > 0 ? Math.min(0.1, (nowMs - s.lastFrameMs) / 1000) : 0;
            s.lastFrameMs = nowMs;
            let maxDiff = 0;
            const len = s.cellTarget.length;
            if (dt > 0) {
                const tau = cur.cellTau ?? CELL_TAU_SECONDS;
                const alpha = 1 - Math.exp(-dt / tau);
                for (let i = 0; i < len; i++) {
                    const d = s.cellTarget[i] - s.cellCur[i];
                    s.cellCur[i] += d * alpha;
                    const ad = Math.abs(d);
                    if (ad > maxDiff) maxDiff = ad;
                }
            } else {
                for (let i = 0; i < len; i++) {
                    const ad = Math.abs(s.cellTarget[i] - s.cellCur[i]);
                    if (ad > maxDiff) maxDiff = ad;
                }
            }

            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const w = Math.max(1, Math.round(cur.cssWidth * dpr));
            const h = Math.max(1, Math.round(cur.cssHeight * dpr));
            renderer.renderFrame(s.bitmapCtx, w, h, cur.cols, cur.rows, s.cellCur, {
                moleculeTime: cur.moleculeTime ?? 0,
                density: cur.density ?? 0.6,
                glow: cur.glow ?? 0.8,
                iridescence: cur.iridescence ?? 0,
                overflow: cur.overflow ?? 1.0,
                activeRegion: cur.activeRegion ?? { kind: 'full' },
                dormantBrightness: cur.dormantBrightness ?? 0.02,
                dormantGreyAlpha: cur.dormantGreyAlpha ?? 0.25,
            });

            if (maxDiff > CONVERGE_EPS) {
                s.raf = requestAnimationFrame(renderFrame);
            } else {
                s.cellCur.set(s.cellTarget);
                s.raf = null;
                s.lastFrameMs = 0;
            }
        };

        acquireSharedRenderer().then(r => {
            if (cancelled || !r) return;
            renderer = r;
            const s = stateRef.current;
            if (!s) return;
            /* If a transition is already in flight (deps changed mid-tween
             * and the rAF loop is still running), don't kick a second one. */
            if (s.raf == null) {
                s.lastFrameMs = 0;
                s.raf = requestAnimationFrame(renderFrame);
            }
        });

        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canvasRef, opts.cols, opts.rows, opts.cssWidth, opts.cssHeight,
        opts.cellTau, opts.glow, opts.iridescence, opts.dormantBrightness, opts.dormantGreyAlpha,
        ...(opts.deps ?? [])]);
}
