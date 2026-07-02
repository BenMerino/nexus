// The signed-in user's breadcrumb trail, appended after the tenant crumb in the
// authed header (AuthLayout). The tenant is crumb 0 (name + ROR); this adds the
// academic (name + ORCID) and their faculty/department. Pure — each crumb is
// omitted when its data is missing (not every user resolves to an ORCID or a
// faculty), so the trail gracefully shortens to just the tenant.

import type { CurrentUser } from "../shell-helpers";
import type { Crumb } from "../tenant-header";

export function userCrumbs(me: CurrentUser): Crumb[] {
  const p = me.profile;
  if (!p) return [];
  const crumbs: Crumb[] = [];

  const name = p.researcherName || p.name;
  if (name) {
    crumbs.push({
      name,
      sub: p.orcid
        ? { label: "ORCID", id: p.orcid, href: `https://orcid.org/${p.orcid}` }
        : null,
    });
  }

  if (p.faculty) crumbs.push({ name: p.faculty });

  return crumbs;
}
