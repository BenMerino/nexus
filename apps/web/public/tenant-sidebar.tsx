import React from 'react';
import { Ico } from './ui-kit';
import type { PublicView } from './use-public-route';
import { ES } from './tenant-i18n';
import { VolcanoMark } from './brand-mark';

/* The public tenant nav — a floating glass sidebar (shared .sidebar chrome) with
 * the 5 entity links. Anonymous/read-only, so no role-switcher/user row (that's
 * the authed Sidebar). Links are real /t/:slug/<entity> hrefs for shareability;
 * clicks are intercepted to client-route (pushState, no reload). */

const NAV: { id: PublicView; label: string; icon: keyof typeof Ico }[] = [
  { id: 'overview',  label: 'Overview',  icon: 'home' },
  { id: 'faculties', label: 'Faculties', icon: 'graph' },
  { id: 'academics', label: 'Academics', icon: 'people' },
  { id: 'papers',    label: 'Papers',    icon: 'paper' },
  { id: 'journals',  label: 'Journals',  icon: 'tag' },
];

export function TenantSidebar({ view, navigate, hrefFor, search }: {
  view: PublicView;
  navigate: (v: PublicView) => void;
  hrefFor: (v: PublicView) => string;
  search?: React.ReactNode;
}) {
  return (
    <aside className="sidebar">
      {/* Product brand (mark + tagline) — same slot the authed Sidebar fills
          with the Pliny tenant-chip. Tenant identity now lives in the header
          breadcrumb instead, so this reads as ONE brand, not a duplicate. */}
      <div className="tenant-chip">
        <div className="tenant-brand">
          <VolcanoMark />
          <div className="brand-text">
            <div className="brand-name">{ES.pliny}</div>
            <div className="brand-tenant">{ES.researchIntelligence}</div>
          </div>
        </div>
      </div>
      {/* Omnibox as the sidebar's top row — same placement as the authed
          SidebarSearch (shell-sidebar.tsx), always visible, not header-bound. */}
      {search}
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
