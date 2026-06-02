import React from 'react';
import { Ico } from './shell-icons';
import { Tag } from './ui-primitives';
import { SidebarSearch } from './shell-search';
import type { CurrentUser } from './shell-helpers';

export interface NavLink { href: string; label: string; icon: keyof typeof Ico; section?: string; }

const DEFAULT_LINKS: NavLink[] = [
  { href: '/dashboard.html',      label: 'Dashboard',      icon: 'home',   section: 'Workspace' },
  { href: '/overview.html',       label: 'Graph explorer', icon: 'graph',  section: 'Workspace' },
  { href: '/explore.html',        label: 'Explore',        icon: 'search', section: 'Workspace' },
  { href: '/collaborators.html',  label: 'Collaborators',  icon: 'people', section: 'Workspace' },
  { href: '/org-scheme.html',     label: 'Organization',   icon: 'graph',  section: 'Workspace' },
  { href: '/proyectos.html',      label: 'Projects',       icon: 'paper',  section: 'Workspace' },
  { href: '/submit.html',         label: 'Submit DOI',     icon: 'submit', section: 'Workspace' },
];
const SUPERADMIN_LINKS: NavLink[] = [
  { href: '/admin.html',         label: 'Admin',         icon: 'build',  section: 'Admin' },
  { href: '/author-import.html', label: 'Author import', icon: 'people', section: 'Admin' },
  { href: '/theme',              label: 'Theme palette', icon: 'gear',   section: 'Admin' },
];
const TENANT_LINKS: NavLink[] = [
  { href: '/settings.html', label: 'Settings', icon: 'gear', section: 'Tenant' },
];
const ROSTER_LINK: NavLink = { href: '/roster.html', label: 'Roster', icon: 'people', section: 'Tenant' };

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
  const role = me?.role ?? '';
  const links = linksFor(me);
  const sections = Array.from(new Set(links.map(l => l.section || '')));
  const tenantName = me?.tenant || (role === 'superadmin' ? 'Superadmin' : 'Nexus');

  return (
    <aside className="sidebar">
      <div className="tenant-chip">
        <div className="tenant-brand">
          <div className="tenant-mark">
            {me?.logo && <img src={me.logo} alt="" />}
          </div>
          <div className="brand-text">
            <div className="brand-name">Nexus</div>
            <div className="brand-tenant">{tenantName} · CRIS</div>
          </div>
        </div>
        {me?.profile.ror && (
          <div className="tenant-chip-meta">
            <Tag mono>ROR {me.profile.ror}</Tag>
          </div>
        )}
      </div>

      {roleSwitcher}

      <SidebarSearch />

      <nav className="nav-list">
        {sections.map(section => (
          <React.Fragment key={section}>
            {section && <div className="nav-section-label">{section}</div>}
            {links.filter(l => (l.section || '') === section).map(l => {
              const active = currentPath === l.href || (l.href === '/dashboard.html' && currentPath === '/');
              return (
                <a key={l.href} href={l.href} className={`nav-item ${active ? 'active' : ''}`}>
                  {Ico[l.icon]} {l.label}
                </a>
              );
            })}
          </React.Fragment>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div><span className="sync-pulse" />Live · authenticated</div>
        <div className="sidebar-user-row">
          <span title={me?.profile.name || me?.user}>
            {me ? initials(me.profile.name || me.user) : '··'}
          </span>
          <a href="/api/auth?action=logout">logout</a>
        </div>
      </div>
    </aside>
  );
}
