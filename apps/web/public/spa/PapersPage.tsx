// Papers page (/papers). The body that lived in papers.html, ported to React
// Router. The legacy papers.tsx entry owns the actual render into #papers-root;
// this page provides that mount node + drives its (re)mount on every route entry
// via the legacy-mount bridge. papers.html carried no page-specific <style>
// block (its .paper-* styles live in the shared token/CSS layer), so this page
// renders only the mount node.

import React from 'react';
import { useLegacyMounts } from './legacy-mount';

export function PapersPage() {
  useLegacyMounts([() => import('../papers')]);
  return <div id="papers-root" />;
}
