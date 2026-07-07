# HANDOFF — Graph-Engine Typography Debt (fix in Zincro, sync down)

**Status:** open · **Created:** 2026-06-29 · **Owner-of-fix:** Zincro (`packages/shared/src/ui/graph-engine`)

## Why this exists
The 2026-06 typography normalization made `ui/dna/type-scale.js` the single source of
truth for nexus type, generated into `dna.css` + `tokens.ts` (`npm run gen:type`), and
added an arch-audit **N3-type** guard that blocks raw `font-size/weight/family` in
`apps/web/**`. **`ui/graph-engine/` is exempt** from that guard because it is **vendored
from Zincro** (synced via `scripts/sync-engine.sh`) — hand-edits in nexus revert on the
next sync. So its hardcoded type is tracked here as upstream debt rather than patched
locally.

47 hardcoded type sites remain in the vendored graph-engine. Two distinct kinds:

- **DOM/CSS (30):** React `<BaseText>` / inline `style={{ fontSize: '9px' }}` — these
  CAN consume CSS vars once fixed upstream → map to `var(--text-*)` / `var(--weight-*)`.
- **SVG-numeric (14):** `<text fontSize={9}>` attributes in user-units — these CANNOT
  take a CSS var. They need a **named constants module** in Zincro's engine defaults.
- **Type defs / layout-metric constants (3):** no value change (e.g. `HEATMAP_TICK_CHAR_PX`
  is a glyph-width metric, not a font size).

## Upstream Zincro change (3 parts)
1. **Add a chart-type constants block** to Zincro's `engine-visual-defaults.ts` — one
   named export per SVG numeric (`CHART_X_AXIS_TICK_PX`, `CHART_DONUT_TOTAL_PX`,
   `CHART_GAUGE_VALUE_PX`, `CHART_VALUE_LABEL_PX`, …). SVG `<text>` reads these instead
   of inline magic numbers. One source for chart-tick type → future rescale is one edit.
2. **Convert DOM/CSS sites** (`<BaseText>` + inline style) to the token vars
   (`var(--text-micro/label/detail)`, `var(--weight-semibold/bold)`,
   `var(--tracking-*)`). These resolve in nexus because the tokens already exist.
3. **De-dupe cross-file constants:** `TICK_FONT_AVG_CHAR_PX = 5` is defined in both
   `ChromeXAxisBand.tsx` and `x-axis-reserve.ts` — lift to one engine default.

After the Zincro fix lands, `bash scripts/sync-engine.sh --apply` pulls it down and this
debt closes. No nexus exclusion-list change is needed (the guard exemption for
`ui/graph-engine/` stays — SVG-numeric type is legitimately engine-owned).

## Site inventory (file → line → value → fix)

### DOM/CSS — map to tokens
| File | Line | Value | → |
|------|------|-------|---|
| WindowPickerMolecule.tsx | 76 | `fontSize:'9px'` | `--text-micro` |
| DrillBreadcrumbChip.tsx | 34, 38 | `'9px'/600/0.04em`, `'10px'` | `--text-micro`, `--weight-semibold`, `--text-micro` |
| QueryToggleBar.tsx | 34 | `'9px'/600/0.04em` | `--text-micro`, `--weight-semibold` |
| LegibilityAlert.tsx | 32 | `letterSpacing:'0.05em'` | tracking token |
| WindowCalendar.tsx | 83, 96, 101 | `'11px'`, `'11px'`, `'9px'` | `--text-label`, `--text-label`, `--text-micro` |
| ChartRangeSlider.tsx | 275 | `'9px'/600/0.04em` | `--text-micro`, `--weight-semibold` |
| ChartKpiHeader.tsx | 73, 74 | `lineHeight:1`, `0.12em` | `--leading-tight`, `--tracking-label` |
| svg-parts.tsx | 79, 83 | `9/0.05em/700`, `12/600` | `--text-micro`/`--weight-bold`, `--text-label`/`--weight-semibold` |
| GraphRender.tsx | 254 | `'9px'/600` | `--text-micro`, `--weight-semibold` |
| ValueLegend.tsx | 136,164,176,181,188,251 | `'9px'/'8px'` + 600/700 | `--text-micro`, `--weight-*` |
| ChartBody.tsx | 205 | `'1.0625rem'/1.3` | `--text-h3`, `--leading-h3` |
| ToggleBar.tsx | 51 | `'9px'/600` | `--text-micro`, `--weight-semibold` |
| drag-range.tsx | 206, 209, 212 | `9/0.05em/700`, `12/700`, `11/700` | `--text-micro`/`--text-label`, `--weight-bold` |

### SVG-numeric — need named Zincro constants (cannot use CSS vars)
| File | Line | Value | Proposed constant |
|------|------|-------|-------------------|
| chrome-value-labels.ts | 18-19, 50-51 | `LABEL_FONT=9`, `LABEL_WEIGHT=600` | `CHART_VALUE_LABEL_PX/_WEIGHT` |
| chrome-annotations.ts | 19-20, 47-48 | `ANN_FONT=9`, `ANN_WEIGHT=700` | `CHART_ANNOTATION_PX/_WEIGHT` |
| ChromeXAxisBand.tsx | 20-21, 180, 206 | `TICK_FONT=9`, `TICK_WEIGHT=600` | `CHART_X_AXIS_TICK_PX/_WEIGHT` |
| chart-primitives-radial.ts | 101,108,118,126,143,151,190,235,254,275,290 | `fontSize:7/8/9/16/18/22` + weights | per-shape `CHART_*_PX/_WEIGHT` (donut/gauge/radar/heatmap/treemap) |

### No action (type defs / layout metrics)
`chart-chrome.types.ts:100-101` (interface fields), `x-axis-reserve.ts:20`
(`TICK_FONT_AVG_CHAR_PX` — glyph-width metric), `chart-primitives-radial.ts:222`
(`HEATMAP_TICK_CHAR_PX` — glyph-width metric).
