// Admin console page (/admin). The .view body that lived in admin.html, ported
// to React Router. The legacy admin-*.js entries own all behavior: admin-app.js
// is the orchestrator (loads tenants, wires #btn-back / #btn-new-tenant /
// #btn-institution-import, sets window.openTenant/createNewTenant/saveTenant/
// addSubtenant), admin-author-import.js owns the OpenAlex institution import
// (window.startInstitutionImport/importAuthorWorks/importAllAuthors), and
// admin-indexation.js renders the indexation table (window.idxSeedOpenAlex/
// idxReconcile). This page provides the exact markup + drives their (re)mount on
// every route entry via the legacy-mount bridge, rendered as a raw-HTML block so
// the inline onclick attributes keep working. Page-specific styles + the exact
// markup live in ./admin-markup (kept out of here for the 150-line cap, N5).
//
// The dependency modules (admin-tenant-form.js → window.esc/adminTenantForm/
// pickColor, admin-users.js → window.adminUsers/addUser, color-extract.js →
// extractColors) are side-effect-only: their top-level window.* assignments run
// once on ESM import and persist across remounts, so they export no mount(). We
// still load them here (useLegacyMounts calls mount() optionally, skipping them)
// because admin-app.js references those globals — Promise.all resolves every
// import before any mount() fires, so the globals exist by the time it runs.

import React from 'react';
import { useLegacyMounts } from './legacy-mount';
import { ADMIN_STYLES, ADMIN_BODY } from './admin-markup';

export function AdminPage() {
  useLegacyMounts([
    () => import('../admin-tenant-form.js' as string),
    () => import('../admin-users.js' as string),
    () => import('../color-extract.js' as string),
    () => import('../admin-app.js' as string),
    () => import('../admin-author-import.js' as string),
    () => import('../admin-indexation.js' as string),
  ]);
  return (
    <>
      <style>{ADMIN_STYLES}</style>
      <div className="view" dangerouslySetInnerHTML={{ __html: ADMIN_BODY }} />
    </>
  );
}
