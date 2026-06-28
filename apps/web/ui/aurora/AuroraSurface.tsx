import React, { useMemo, useRef } from 'react';
import { useAuroraShader } from './useAuroraShader.js';
import { DEFAULT_AURORA_TUNING, type AuroraTuning } from './aurora.tuning.js';
import { type AuroraPalette } from './aurora.palettes.js';

export interface AuroraSurfaceProps {
    /** Color sub-variant — its 3 stops are generated from the palette's base
     *  hue + shared constants, with the light/dark ratio flipped by theme.
     *  Defaults to 'primary'. Overridden by an explicit `tuning.colors`. */
    palette?: AuroraPalette;
    /** Partial tuning overrides; anything missing falls back to defaults.
     *  An explicit `colors` array here wins over the palette. */
    tuning?: Partial<AuroraTuning>;
    className?: string;
}

/* A GPU-driven living mesh-gradient FILL surface. Absolutely fills its
 * positioned parent (`inset:0`), so it drops in as a button background behind
 * the label. Colors come from the `palette` sub-variant (generated from its
 * base hue + shared axes). A sibling GPU molecule to the particle surfaces, but
 * a rectangular gradient rather than a point cloud — the living button token. */
export const AuroraSurface: React.FC<AuroraSurfaceProps> = ({ palette = 'primary', tuning, className }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const merged = useMemo<AuroraTuning>(() => ({
        ...DEFAULT_AURORA_TUNING,
        ...tuning,
    }), [tuning]);
    const tuningRef = useRef(merged);
    tuningRef.current = merged;
    const paletteRef = useRef(palette);
    paletteRef.current = palette;

    useAuroraShader(canvasRef, tuningRef, paletteRef);

    return (
        <canvas
            ref={canvasRef}
            className={className}
            aria-hidden="true"
            style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                display: 'block',
                pointerEvents: 'none',
            }}
        />
    );
};
