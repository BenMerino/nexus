// Academics page (/academics). The body that lived in academics.html, ported
// to React Router. The legacy academics.tsx entry owns the actual render into
// #academics-root; this page provides that mount node + drives its (re)mount on
// every route entry via the legacy-mount bridge. academics.html carried no
// page-specific <style> block, so nothing travels with the page here.

import React from 'react';
import { useLegacyMounts } from './legacy-mount';

export function AcademicsPage() {
  useLegacyMounts([() => import('../academics')]);
  return <div id="academics-root" />;
}
