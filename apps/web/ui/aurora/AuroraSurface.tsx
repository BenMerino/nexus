import React, { useMemo, useRef } from 'react';
import { useAuroraShader } from './useAuroraShader.js';
import { DEFAULT_AURORA_TUNING, type AuroraTuning } from './aurora.tuning.js';

export interface AuroraSurfaceProps {
    /** Partial tuning overrides; anything missing falls back to defaults. An
     *  explicit `colors` array wins over the default sun-pipeline stops. */
    tuning?: Partial<AuroraTuning>;
    className?: string;
}

/* A GPU-driven living mesh-gradient FILL surface. Absolutely fills its
 * positioned parent (`inset:0`), so it drops in as a button background behind
 * the label. Colors DERIVE from the day/night sun pipeline (sunStops →
 * sky-driven :root tokens), so the button gradient shifts with the sky. A
 * sibling GPU molecule to the particle surfaces — the living button token. */
export const AuroraSurface: React.FC<AuroraSurfaceProps> = ({ tuning, className }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const merged = useMemo<AuroraTuning>(() => ({
        ...DEFAULT_AURORA_TUNING,
        ...tuning,
    }), [tuning]);
    const tuningRef = useRef(merged);
    tuningRef.current = merged;

    useAuroraShader(canvasRef, tuningRef);

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
