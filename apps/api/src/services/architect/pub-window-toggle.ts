/* ── Shared publications window toggle ──────────────────────
 * The single server-side definition of the window-range toggle for replayable
 * publication time-charts (byIndex, cadence) — mirrors Zincro's
 * graph-toggles.ts:rangeToggle. One option-set, imported by every composer that
 * stamps a replayable directive, so the 5y/10y/20y/All set lives in one place.
 *
 * Academic output is decade-scale, so the offsets are year-equivalents of the
 * engine's `windowDays` unit. Parallels the web fallback's copy in
 * tenant-year-chart.ts (its sanctioned N8 exception) — kept independent so the
 * api never imports the web tree.
 * ──────────────────────────────────────────────────────────── */

export interface WindowToggle {
  id: "windowDays";
  field: "windowDays";
  valueType: "numberOrNull";
  current: string;
  options: { value: string; label: string }[];
}

/** The window-range toggle. `current` reflects the active windowDays (the
 *  controller re-reads it; default 'null' = All). */
export function pubWindowToggle(currentWindowDays: number | null = null): WindowToggle {
  return {
    id: "windowDays",
    field: "windowDays",
    valueType: "numberOrNull",
    current: String(currentWindowDays ?? "null"),
    options: [
      { value: "1825", label: "5y" },
      { value: "3650", label: "10y" },
      { value: "7305", label: "20y" },
      { value: "null", label: "All" },
    ],
  };
}
