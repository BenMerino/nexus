// Faculties page (/faculties). The body that lived in faculties.html, ported
// to React Router. The legacy faculties.tsx entry owns the actual render into
// #faculties-root; this page provides that mount node + drives its (re)mount on
// every route entry via the legacy-mount bridge. The page-specific org-tree
// styles (not chrome — N9) travel with the page here, as they did in the
// old faculties.html <style> block.

import React from 'react';
import { useLegacyMounts } from './legacy-mount';

const styles = `
  .org-tree { display: flex; flex-direction: column; gap: 2px; }
  .org-node { display: flex; flex-direction: column; }
  .org-row { display: flex; align-items: center; gap: 10px; padding: 9px 6px; position: relative; }
  .org-row:hover { background: var(--bg-inset); }
  .org-twist { font-size: var(--text-micro); color: var(--fg-dim); width: 12px; flex: none; }
  .org-name { font-size: var(--text-body); }
  .org-name.fac { font-weight: var(--weight-label); }
  .org-name.dep { color: var(--fg-muted); font-size: var(--text-detail); }
  .org-kind { font-family: var(--font-mono); font-size: var(--text-micro); letter-spacing: var(--tracking-label); text-transform: uppercase; color: var(--fg-dim); }
  .org-metrics { margin-left: auto; display: flex; gap: 6px; flex: none; }
  .org-pill { font-family: var(--font-mono); font-size: var(--text-micro); color: var(--fg-dim); border: var(--border-w) solid var(--border-soft); padding: 2px 8px; border-radius: var(--radius-pill); white-space: nowrap; }
  .org-children { display: flex; flex-direction: column; }
`;

export function FacultiesPage() {
  useLegacyMounts([() => import('../faculties')]);
  return (
    <>
      <style>{styles}</style>
      <div id="faculties-root" />
    </>
  );
}
