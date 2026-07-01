// Graph explorer page (/overview). The body that lived in overview.html,
// ported to React Router. The legacy relationships.tsx entry owns the actual
// render into #relationships-root (it mounts <GraphExplorerBody />); this page
// provides that mount node + drives its (re)mount on every route entry via the
// legacy-mount bridge.
//
// FULLBLEED: overview.html used <main class="main main-fullbleed"> so the graph
// canvas spans the shell edge-to-edge. This page can't set that class itself
// (AuthLayout owns <main>) — the integrator adds "main-fullbleed" to <main> for
// this route. No page-specific <style> existed in overview.html, so none travels.

import React from 'react';
import { useLegacyMounts } from './legacy-mount';

export function GraphExplorerPage() {
  useLegacyMounts([() => import('../relationships')]);
  return <div id="relationships-root" />;
}
