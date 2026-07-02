// The signed-in user's breadcrumb trail, appended after the tenant crumb in the
// authed header (AuthLayout). The tenant is crumb 0 (name + ROR); this adds ONE
// Author crumb — the academic's name, with ORCID and faculty stacked beneath as
// profile facts. Per DGA_DESIGN faculty is an Author *field*, not a parent
// entity (only Institution→Author are governed), so it is not its own crumb.
// Pure — subs are omitted when their data is missing; the crumb itself drops if
// the user has no resolvable name (trail shortens to just the tenant).

import type { CurrentUser } from "../shell-helpers";
import type { Crumb, CrumbSub } from "../tenant-header";

export function userCrumbs(me: CurrentUser): Crumb[] {
  const p = me.profile;
  if (!p) return [];

  const name = p.researcherName || p.name;
  if (!name) return [];

  const subs: CrumbSub[] = [];
  if (p.orcid) subs.push({ label: "ORCID", text: p.orcid, href: `https://orcid.org/${p.orcid}` });
  if (p.faculty) subs.push({ text: p.faculty });

  return [{ name, subs }];
}
