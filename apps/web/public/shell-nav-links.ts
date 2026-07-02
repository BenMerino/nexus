import { Ico } from './shell-icons';
import type { CurrentUser } from './shell-helpers';

export interface NavLink { href: string; label: string; icon: keyof typeof Ico; section?: string; }

// Entity-centric nav: one item per DGA domain entity, in dependency order
// (the whole-tenant view, then org → people → outputs → venues). The graph
// explorer + projects + submit stay as workspace tools below the entities.
// Hrefs are extensionless React-Router routes (all pages are SPA routes now).
// This is the ONE source of truth for path→label: the sidebar renders it, and
// the header breadcrumb derives its page-title crumb from the same labels.
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

export function linksFor(me: CurrentUser | null): NavLink[] {
  const role = me?.role ?? '';
  // tenant_admin (capability, separate from role) unlocks roster import for
  // the user's own tenant — superadmins always have it.
  const tenantLinks = (me?.tenantAdmin || role === 'superadmin')
    ? [ROSTER_LINK, ...TENANT_LINKS]
    : TENANT_LINKS;
  if (role === 'superadmin') return [...DEFAULT_LINKS, ...SUPERADMIN_LINKS, ...tenantLinks];
  return [...DEFAULT_LINKS, ...tenantLinks];
}

// The full route→label set (role-independent), for the header's page-title
// crumb. Uses every link a route could carry so the crumb resolves regardless
// of the viewer's role.
const ALL_LINKS: NavLink[] = [...DEFAULT_LINKS, ...SUPERADMIN_LINKS, ...TENANT_LINKS, ROSTER_LINK];

export function pageTitleFor(path: string): string | null {
  const p = path === '/' ? '/dashboard' : path;
  return ALL_LINKS.find(l => l.href === p)?.label ?? null;
}
