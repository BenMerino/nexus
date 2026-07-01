// Journals page (/journals). The body that lived in journals.html, ported
// to React Router. The legacy journals.tsx entry owns the actual render into
// #journals-root; this page provides that mount node + drives its (re)mount on
// every route entry via the legacy-mount bridge. journals.html carried no
// page-specific <style> block (its table/tag styling comes from the shared
// token layer), so there is nothing extra to inline here.

import React from 'react';
import { useLegacyMounts } from './legacy-mount';

export function JournalsPage() {
  useLegacyMounts([() => import('../journals')]);
  return <div id="journals-root" />;
}
