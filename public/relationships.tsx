import React from 'react';
import { createRoot } from 'react-dom/client';
import { GraphExplorerBody } from './graph-explorer-body';

const el = document.getElementById('relationships-root');
if (el) createRoot(el).render(<GraphExplorerBody />);
