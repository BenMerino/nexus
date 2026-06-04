/* ── Publications granularity (fold-unit) toggle ────────────
 * The single server-side definition of the level toggle for the replayable
 * publication time-charts (byIndex, cadence). The continuous windowDays range
 * slider + its 5y/10y/20y/All toggle were removed — navigation is pure
 * click-to-drill (click a bar/period → its sub-periods) plus this level toggle
 * as a quick jump. The toggle maps to `query.foldUnit`; the engine honors it
 * and `eligibleFoldUnits` (client) hides rungs that would over-bucket the span.
 *
 * Academic output is decade/century-scale, so the ladder runs Century→Month
 * (no week/day/hour level pill — drill into a month to reach days).
 * ──────────────────────────────────────────────────────────── */

export interface GranularityToggle {
  id: "foldUnit";
  field: "foldUnit";
  valueType: "string";
  current: string;
  options: { value: string; label: string }[];
}

export type PubToggle = GranularityToggle;

/** The level (fold-unit) toggle. `auto` lets the renderer pick from the visible
 *  span; the explicit rungs jump to that level of the current period. */
export function pubGranularityToggle(currentFoldUnit: string | null = null): GranularityToggle {
  return {
    id: "foldUnit",
    field: "foldUnit",
    valueType: "string",
    current: currentFoldUnit ?? "auto",
    options: [
      { value: "auto", label: "Auto" },
      { value: "century", label: "Century" },
      { value: "decade", label: "Decade" },
      { value: "year", label: "Year" },
      { value: "month", label: "Month" },
    ],
  };
}
