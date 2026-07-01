import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { GraphExplorerBody } from './graph-explorer-body';

let root: Root | null = null;
// Exported for the SPA page (spa/GraphExplorerPage.tsx) to re-invoke on every
// React mount — legacy-mount.ts contract. Idempotent: unmounts the prior root
// first, which also tears down the body's internal hover/prefetch timers.
// Registered on __nexusMounts too, for the legacy spa-router.js path (still
// used by not-yet-migrated pages during the migration window).
export function mount() {
  const el = document.getElementById('relationships-root');
  if (!el) return;
  if (root) root.unmount();
  root = createRoot(el);
  root.render(<GraphExplorerBody />);
}
