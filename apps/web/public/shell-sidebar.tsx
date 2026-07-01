import React from 'react';
import { Link } from 'react-router-dom';
import { Ico } from './shell-icons';
import { SidebarSearch } from './shell-search';
import type { CurrentUser } from './shell-helpers';
import { VolcanoMark } from './brand-mark';

export interface NavLink { href: string; label: string; icon: keyof typeof Ico; section?: string; }

// Entity-centric nav: one item per DGA domain entity, in dependency order
// (the whole-tenant view, then org → people → outputs → venues). The graph
// explorer + projects + submit stay as workspace tools below the entities.
// Hrefs are extensionless React-Router routes (all pages are SPA routes now).
const DEFAULT_LINKS: NavLink[] = [
  { href: '/dashboard',   label: 'Overview',   icon: 'home',   section: 'Entities' },
  { href: '/faculties',   label: 'Faculties',  icon: 'graph',  section: 'Entities' },
  { href: '/academics',   label: 'Academics',  icon: 'people', section: 'Entities' },
  { href: '/papers',      label: 'Papers',     icon: 'paper',  section: 'Entities' },
  { href: '/journals',    label: 'Journals',   icon: 'tag',    section: 'Entities' },
  { href: '/overview',    label: 'Graph explorer', icon: 'search', section: 'Workspace' },
  { href: '/proyectos',   label: 'Projects',   icon: 'paper',  section: 'Workspace' },
  { href: '/submit',      label: 'Submit DOI', icon: 'submit', section: 'Workspace' },
];
const SUPERADMIN_LINKS: NavLink[] = [
  { href: '/admin',         label: 'Admin',         icon: 'build',  section: 'Admin' },
  { href: '/author-import', label: 'Author import', icon: 'people', section: 'Admin' },
  { href: '/theme',         label: 'Theme palette', icon: 'gear',   section: 'Admin' },
];
const TENANT_LINKS: NavLink[] = [
  { href: '/settings', label: 'Settings', icon: 'gear', section: 'Tenant' },
];
const ROSTER_LINK: NavLink = { href: '/roster', label: 'Roster', icon: 'people', section: 'Tenant' };

function linksFor(me: CurrentUser | null): NavLink[] {
  const role = me?.role ?? '';
  // tenant_admin (capability, separate from role) unlocks roster import for
  // the user's own tenant — superadmins always have it.
  const tenantLinks = (me?.tenantAdmin || role === 'superadmin')
    ? [ROSTER_LINK, ...TENANT_LINKS]
    : TENANT_LINKS;
  if (role === 'superadmin') return [...DEFAULT_LINKS, ...SUPERADMIN_LINKS, ...tenantLinks];
  return [...DEFAULT_LINKS, ...tenantLinks];
}

function initials(name: string): string {
  return name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

interface SidebarProps {
  me: CurrentUser | null;
  currentPath: string;
  roleSwitcher?: React.ReactNode;
}

export function Sidebar({ me, currentPath, roleSwitcher }: SidebarProps) {
  const links = linksFor(me);
  const sections = Array.from(new Set(links.map(l => l.section || '')));

  return (
    <aside className="sidebar">
      {/* Product brand only — no tenant name, no ROR. Tenant identity lives
          in the header breadcrumb (TenantPublicHeader, rendered alongside this
          sidebar in AuthLayout), same split as the public shell. */}
      <div className="tenant-chip">
        <div className="tenant-brand">
          <VolcanoMark />
          <div className="brand-text">
            <div className="brand-name">Pliny</div>
            <div className="brand-tenant">Research Intelligence</div>
          </div>
        </div>
      </div>

      {roleSwitcher}

      <SidebarSearch />

      <nav className="nav-list">
        {sections.map(section => (
          <React.Fragment key={section}>
            {section && <div className="nav-section-label">{section}</div>}
            {links.filter(l => (l.section || '') === section).map(l => {
              const active = currentPath === l.href || (l.href === '/dashboard' && currentPath === '/');
              return (
                <Link key={l.href} to={l.href} className={`nav-item ${active ? 'active' : ''}`}>
                  {Ico[l.icon]} {l.label}
                </Link>
              );
            })}
          </React.Fragment>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div><span className="sync-pulse" />Live · authenticated</div>
        <div className="sidebar-user-row">
          <span title={me?.profile?.name || me?.user}>
            {me ? initials(me.profile?.name || me.user) : '··'}
          </span>
          <a href="/api/auth?action=logout">logout</a>
        </div>
      </div>
    </aside>
  );
}
