import React from 'react';
import { createRoot } from 'react-dom/client';
import { Shell } from './shell';
import { GraphExplorerBody } from './graph-explorer-body';

function App() {
  return (
    <Shell scroll>
      <GraphExplorerBody />
    </Shell>
  );
}

const el = document.getElementById('relationships-root');
if (el) createRoot(el).render(<App />);
