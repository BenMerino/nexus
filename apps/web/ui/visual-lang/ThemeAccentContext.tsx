/**
 * The AI-glow channel of the per-tenant accent.
 *
 * The HDR glow ring paints from RGBA constants, not CSS vars (the WebGPU
 * canvas can't read `var(--…)`), so the accent reaches it through React
 * context instead of the inline `:root` vars used for UI + charts. The app
 * sets the provider value from the tenant's saved accent; AI-glow consumers
 * (FusedSearchHeader, AiGlowEdge) read it and fall back to the platform
 * `AI_GLOW_COLORS` when unset / `multicolor`.
 */

import React, { createContext, useContext } from 'react';
import { AI_GLOW_COLORS, type GlowColors } from './ai-glow-ring.js';
import { resolveAccent } from './accent-themes.js';

const ThemeAccentContext = createContext<GlowColors>(AI_GLOW_COLORS);

export function ThemeAccentProvider({ accentId, children }: { accentId?: string; children: React.ReactNode }) {
    const glow = resolveAccent(accentId).aiGlow ?? AI_GLOW_COLORS;
    return <ThemeAccentContext.Provider value={glow}>{children}</ThemeAccentContext.Provider>;
}

/** The active AI-glow colors — tenant accent if set, else platform default. */
export function useAiGlowColors(): GlowColors {
    return useContext(ThemeAccentContext);
}
