import React from 'react';
import { StatusPill } from '../primitives/StatusPill.js';

/* ── UnavailableHint ─────────────────────────────────────────
 * Why a list row is disabled — rendered as a real row-level PILL, the
 * same affordance every status tag uses (StatusPill, neutral tone), not
 * floating text. Pair it with a `disabled` option so a greyed row reads
 * as "exists but you can't pick it, here's why":
 *
 *   { value, label, disabled: true,
 *     rightAccessory: <UnavailableHint reason="Beyond data" /> }
 *
 * It IS a neutral StatusPill — so it inherits the shared pill chrome
 * (tinted glass surface, pill radius, row-fit sizing) and stays visually
 * consistent with other row tags by construction. The REASON string is
 * the caller's domain concern ("Beyond data", "No access", "Sold out");
 * restyle via StatusPill / --status tokens, never at call sites. */

export interface UnavailableHintProps {
    /** Why the row is unavailable — short, e.g. "Beyond data", "No access". */
    reason: string;
    className?: string;
}

export function UnavailableHint({ reason, className }: UnavailableHintProps) {
    return <StatusPill tone="neutral" label={reason} size="sm" className={className} />;
}
