import React from 'react';
import { TenantPublicHeader } from './tenant-header';
import { TenantSidebar } from './tenant-sidebar';
import { TenantSearch } from './tenant-search';
import type { PublicView } from './use-public-route';
import type { UnitScope } from './tenant-scope-rail';

/* The ONE public-page chrome assembler (N9). Every public page renders its body
 * inside <PublicShell> and therefore CANNOT omit a chrome piece — the .app grid,
 * the floating header, the floating sidebar, AND the omnibox search are built
 * here, once. Before this existed each page hand-assembled chrome and silently
 * dropped whatever it forgot (author.html lost its sidebar and search).
 *
 * The shell fixes STRUCTURE; the page supplies ROUTING INTENT via props:
 *  - tenant page: sidebar/search route CLIENT-SIDE (in-place view swap + rescope)
 *  - author page: sidebar/search route FULL-NAV (leave the profile)
 * so both share identical chrome without the shell hardcoding either behavior. */

interface TenantLike {
  name: string; ror_id: string | null; logo_url: string | null;
}

export interface PublicShellProps {
  /** Header branding + sidebar tenant name. Null while chrome is still loading;
   *  the sidebar/header simply don't paint until it lands (page shows a skeleton
   *  in the content slot). */
  tenant: TenantLike | null;
  slug: string;
  /** The active entity view for sidebar highlighting. Pass a non-matching value
   *  (e.g. '') on pages that are not themselves an entity view (author profile). */
  view: PublicView;
  /** Sidebar link target (client-route href or full-nav href). */
  hrefFor: (v: PublicView) => string;
  /** Sidebar click. Client pages swap in place; full-nav pages set location. */
  navigate: (v: PublicView) => void;
  /** Omnibox unit selection — rescope in place (tenant) or navigate (author). */
  onSelectUnit: (u: UnitScope) => void;
  /** Header freshness badge (corpus last-updated / max year). */
  yearRange?: { minYear: string | null; maxYear: string | null };
  lastUpdated?: string | null;
  /** The page body — rendered inside .public-content. */
  children: React.ReactNode;
}

export function PublicShell({
  tenant, slug, view, hrefFor, navigate, onSelectUnit,
  yearRange, lastUpdated, children,
}: PublicShellProps) {
  return (
    /* app-headered pins the fixed-chrome layout from the FIRST paint. Without
       it the layout hangs on `:has(> .public-header)` — false until the tenant
       fetch resolves and the header mounts, so the pre-fetch skeleton painted
       in grid mode (sidebar column + .public-main's fixed-sidebar padding =
       double offset) and snapped ~280px left when the header landed. */
    <div className="app app-headered">
      {/* Header is now a breadcrumb only — no search slot. Sidebar carries the
          omnibox as its top row, same placement as the authed SidebarSearch. */}
      {tenant && (
        <TenantPublicHeader tenant={tenant} items={[]} currentId={view}
          onNavigate={() => {}} yearRange={yearRange} lastUpdated={lastUpdated} />
      )}
      <TenantSidebar view={view} navigate={navigate} hrefFor={hrefFor}
        search={<TenantSearch slug={slug} onSelectUnit={onSelectUnit} />} />
      <div className="public-app">
        <main className="public-main">
          <div className="public-content">{children}</div>
        </main>
      </div>
    </div>
  );
}
