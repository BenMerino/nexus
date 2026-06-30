import React from 'react';
import { Ico } from './ui-kit';
import type { PublicView } from './use-public-route';

/* The public tenant nav — a floating glass sidebar (shared .sidebar chrome) with
 * the 5 entity links. Anonymous/read-only, so no tenant-chip/role-switcher/user
 * row (that's the authed Sidebar). Links are real /t/:slug/<entity> hrefs for
 * shareability; clicks are intercepted to client-route (pushState, no reload). */

const NAV: { id: PublicView; label: string; icon: keyof typeof Ico }[] = [
  { id: 'overview',  label: 'Overview',  icon: 'home' },
  { id: 'faculties', label: 'Faculties', icon: 'graph' },
  { id: 'academics', label: 'Academics', icon: 'people' },
  { id: 'papers',    label: 'Papers',    icon: 'paper' },
  { id: 'journals',  label: 'Journals',  icon: 'tag' },
];

export function TenantSidebar({ tenantName, view, navigate, hrefFor }: {
  tenantName: string;
  view: PublicView;
  navigate: (v: PublicView) => void;
  hrefFor: (v: PublicView) => string;
}) {
  return (
    <aside className="sidebar">
      <div className="tenant-chip">
        <div className="brand-text">
          <div className="brand-name">{tenantName}</div>
          <div className="brand-tenant">Research · Public</div>
        </div>
      </div>
      <nav className="nav-list">
        {NAV.map(n => (
          <a key={n.id} href={hrefFor(n.id)}
             className={`nav-item ${view === n.id ? 'active' : ''}`}
             onClick={e => { e.preventDefault(); navigate(n.id); }}>
            {Ico[n.icon]} {n.label}
          </a>
        ))}
      </nav>
    </aside>
  );
}
