import React from 'react';
import { ES } from './tenant-i18n';
import { toggleMode } from './public-theme-toggle';

interface TenantLike { name: string; ror_id: string | null; logo_url: string | null; }
export interface PublicNavItem { id: string; label: string; }

const ROR_HOST = 'https://ror.org/';
function rorHref(raw: string): string { return raw.startsWith('http') ? raw : `${ROR_HOST}${raw}`; }
function rorId(raw: string): string { const m = raw.match(/([^/]+)$/); return m ? m[1] : raw; }
function initial(name: string): string { return (name.trim()[0] || '·').toUpperCase(); }

// Sun (shown in dark mode → go light) / moon (shown in light mode → go dark);
// CSS flips which is visible on data-theme.
function ThemeButton() {
  return (
    <button className="theme-btn" aria-label={ES.themeToggle} title={ES.themeToggle}
            onClick={() => toggleMode()}>
      <svg className="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 2.5v2.6M12 18.9v2.6M21.5 12h-2.6M5.1 12H2.5M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8M18.4 18.4l-1.8-1.8M7.4 7.4 5.6 5.6" strokeLinecap="round" />
      </svg>
      <svg className="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M20 14.5A8 8 0 1 1 9.5 4a6.3 6.3 0 0 0 10.5 10.5z" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

export function TenantPublicHeader({
  tenant, items, currentId, onNavigate, yearRange,
}: {
  tenant: TenantLike;
  items: PublicNavItem[];
  currentId: string;
  onNavigate: (id: string) => void;
  yearRange?: { minYear: string | null; maxYear: string | null };
}) {
  // yearRange may be absent if the analytics payload wins the load race (it
  // carries no yearRange) — guard so the header never throws on .maxYear.
  const updated = yearRange?.maxYear ? `${ES.updatedPrefix} ${yearRange.maxYear}` : ES.publicProfileBadge;
  return (
    <header className="public-header">
      <div className="public-brand">
        {tenant.logo_url
          ? <img className="public-logo" src={tenant.logo_url} alt="" />
          : <span className="public-logo-fallback" data-initial={initial(tenant.name)} />}
        <div>
          <div className="public-tenant-name">{tenant.name}</div>
          <div className="public-tenant-sub">
            <span>{ES.researchIntelligence}</span>
            {tenant.ror_id ? <> · <a href={rorHref(tenant.ror_id)} target="_blank" rel="noopener noreferrer">ROR {rorId(tenant.ror_id)}</a></> : null}
          </div>
        </div>
      </div>
      <nav className="public-tabs" aria-label="Section navigation">
        {items.map(it => (
          <a key={it.id} href={`#${it.id}`}
             className={`public-tab${currentId === it.id ? ' active' : ''}`}
             onClick={e => { e.preventDefault(); onNavigate(it.id); }}>
            {it.label}
          </a>
        ))}
      </nav>
      <div className="public-header-aux">
        <span className="public-updated"><span className="sync-pulse" /> <span>{updated}</span></span>
        <a href="/login.html" className="public-signin">{ES.signIn}</a>
        <ThemeButton />
      </div>
    </header>
  );
}
