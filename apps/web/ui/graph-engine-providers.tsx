/**
 * nexus EngineConfig adapter + combined provider mount.
 *
 * The vendored Zincro graph-engine has exactly one app-coupling boundary —
 * `EngineConfig` (apiGet / useIsDark / useUiPref), injected via
 * `GraphEngineProvider`. This module wires nexus's concrete implementations to
 * that contract so every synced engine file (useTimelineSpan, ChartGeometryCanvas,
 * FeatureToggleGroup, …) resolves real host behavior instead of the engine's
 * inert defaults. Mount `<GraphProviders tenantId>` at each chart-rendering root.
 *
 * This file is NEXUS-OWNED (not in the sync boundary): it's the host's plug into
 * the shared engine. Keeping all coupling here is what lets every engine file
 * stay byte-shareable with Zincro.
 */

import React from 'react';
import { GraphEngineProvider, type EngineConfig } from './graph-engine/engine-config.js';
import { ChartTuningProvider } from './graph-engine/ChartTuningContext.js';
import { ThemeAccentProvider } from './visual-lang/ThemeAccentContext.js';
import { apiGet } from '../telemetry/apiClient.js';
import { useTheme } from '../hooks/useTheme.js';
import { useUserUiPref } from '../hooks/useUserUiPref.js';

/** nexus's concrete EngineConfig — the three host adapters the engine needs.
 *  Stable module-level identity (the hooks are referenced, not called here). */
export const NEXUS_ENGINE_CONFIG: EngineConfig = {
  apiGet: (url, options) => apiGet(url, options),
  useIsDark: useTheme,
  useUiPref: useUserUiPref,
};

/** Mount the engine + DNA providers around a chart/UI subtree — the single
 *  control point for the vendored layer:
 *   • GraphEngineProvider → host apiGet/dark/pref (slider span, theme, toggles)
 *   • ChartTuningProvider → per-tenant tuning (glow 0 default, server override)
 *   • ThemeAccentProvider → AI-glow colors for composed components that opt in
 *     (FusedSearch header, AiGlowEdge…). nexus drives surface/brand colors via
 *     CSS vars (dna-bridge.css), NOT writeAccentVars — so we mount the glow
 *     context only and leave the CSS cascade to the theme handler. */
export function GraphProviders({
  tenantId, children,
}: {
  tenantId: string;
  children: React.ReactNode;
}) {
  return (
    <GraphEngineProvider value={NEXUS_ENGINE_CONFIG}>
      <ChartTuningProvider tenantId={tenantId}>
        <ThemeAccentProvider>{children}</ThemeAccentProvider>
      </ChartTuningProvider>
    </GraphEngineProvider>
  );
}
