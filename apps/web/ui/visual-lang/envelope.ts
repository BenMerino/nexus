/**
 * Visual language — ADSR envelope physics.
 *
 * The "impulse arrives, ramps up, holds, decays" curve that gives the
 * loader its alive-not-laggy feel. Charts will reuse this exact envelope
 * for value-driven animations (bar growing, line tracing, point landing).
 *
 * Constants are tuned by eye: changing them changes the feel. Don't.
 */

/** Time from impulse arrival to peak. Short enough to feel snappy, long
 *  enough that the rise is visible at 60fps. */
export const ENVELOPE_ATTACK_SECONDS = 0.08;

/** Time the envelope holds at peak before decay starts. Lets cells
 *  visibly inhabit their apex brightness instead of immediately falling. */
export const ENVELOPE_HOLD_SECONDS = 0.18;

/**
 * Evaluate an ADSR envelope at `sinceArrival` seconds after the impulse
 * reached its target.
 *
 *   sinceArrival < 0          → 0 (not yet arrived)
 *   [0, attack)               → linear ramp 0 → 1
 *   [attack, attack+hold)     → 1 (held at peak)
 *   ≥ attack+hold             → exp(-decayRate * (t - attack - hold))
 *
 * Returns the envelope value scaled by `magnitude` (peak amplitude).
 */
export function adsrEnvelope(
    sinceArrival: number,
    magnitude: number,
    decayRate: number,
): number {
    if (sinceArrival < 0) return 0;
    let envelope: number;
    if (sinceArrival < ENVELOPE_ATTACK_SECONDS) {
        envelope = sinceArrival / ENVELOPE_ATTACK_SECONDS;
    } else if (sinceArrival < ENVELOPE_ATTACK_SECONDS + ENVELOPE_HOLD_SECONDS) {
        envelope = 1;
    } else {
        const decayT = sinceArrival - (ENVELOPE_ATTACK_SECONDS + ENVELOPE_HOLD_SECONDS);
        envelope = Math.exp(-decayRate * decayT);
    }
    return magnitude * envelope;
}
