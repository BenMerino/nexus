import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { CoauthorExplorerBody } from './coauthor-explorer-body';

let root: Root | null = null;
function mount() {
  const el = document.getElementById('relationships-root');
  if (!el) return;
  if (root) root.unmount();
  root = createRoot(el);
  root.render(<CoauthorExplorerBody />);
}
(window as any).__nexusMounts = (window as any).__nexusMounts || {};
(window as any).__nexusMounts['/relationships-bundle.js'] = mount;
mount();
