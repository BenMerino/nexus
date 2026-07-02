// Phased mount — the shell's load choreography as a REAL sequence, not an
// animation hack. Elements are laid out phase by phase: each <Phase> renders
// its children into the DOM only once its phase has arrived, so every element
// is a COMPLETE, real element the moment it appears (never pre-rendered then
// hidden/clipped/faded). The sequence always runs to completion — even if all
// data is already present, the phases still play in order. This is the DNA:
// the choreography is the sequential appearance of real elements.
import React, { createContext, useContext, useEffect, useState } from 'react';

// The furthest phase that has arrived (0 = only phase 0, etc.). Provided once
// per shell by <PhaseSequence>; consumed by every <Phase>.
const PhaseCtx = createContext(0);

// Per-phase beat (ms). One knob for the whole cadence; the chrome is phase 0
// and appears immediately, each later phase enters one beat after the prior.
const BEAT = 130;

/** Drives the phase clock: ticks `arrived` 0→1→2… up to `phases-1`, one BEAT
 *  apart, then stops. Runs to completion independent of any data/loading. */
export function PhaseSequence({ phases, children }: { phases: number; children: React.ReactNode }) {
  const [arrived, setArrived] = useState(0);
  useEffect(() => {
    if (arrived >= phases - 1) return;
    const t = setTimeout(() => setArrived((a) => a + 1), BEAT);
    return () => clearTimeout(t);
  }, [arrived, phases]);
  return <PhaseCtx.Provider value={arrived}>{children}</PhaseCtx.Provider>;
}

/** Renders its children only once phase `index` has arrived. Before that the
 *  children are NOT mounted (real phased layout — nothing hidden). On arrival
 *  they mount complete; a one-shot fade eases the genuine mount (fade on a
 *  freshly-mounted element has no pre-hide race — the element simply wasn't
 *  there before). */
export function Phase({ index, children }: { index: number; children: React.ReactNode }) {
  const arrived = useContext(PhaseCtx);
  if (arrived < index) return null;
  return <div className="phase-in">{children}</div>;
}
