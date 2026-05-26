import React from 'react';
import { ES } from './tenant-i18n';

interface TenantLike { name: string; ror_id: string | null; logo_url: string | null; }
export interface PublicNavItem { id: string; label: string; }

const ROR_HOST = 'https://ror.org/';
function rorHref(raw: string): string { return raw.startsWith('http') ? raw : `${ROR_HOST}${raw}`; }
function rorId(raw: string): string { const m = raw.match(/([^/]+)$/); return m ? m[1] : raw; }

export function TenantPublicHeader({
  tenant, items, currentId, onNavigate, yearRange,
}: {
  tenant: TenantLike;
  items: PublicNavItem[];
  currentId: string;
  onNavigate: (id: string) => void;
  yearRange: { minYear: string | null; maxYear: string | null };
}) {
  return (
    <header className="public-header">
      <div className="public-brand">
        {tenant.logo_url
          ? <img className="public-logo" src={tenant.logo_url} alt="" />
          : <span className="public-logo-fallback" />}
        <div>
          <div className="public-tenant-name">{tenant.name}</div>
          <div className="public-tenant-sub">
            <span>{ES.publicProfile}</span>
            {yearRange.minYear && yearRange.maxYear ? <> · <span>{yearRange.minYear}–{yearRange.maxYear}</span></> : null}
            {tenant.ror_id ? <> · <a href={rorHref(tenant.ror_id)} target="_blank" rel="noopener noreferrer">ROR {rorId(tenant.ror_id)}</a></> : null}
          </div>
        </div>
      </div>
      <nav className="public-tabs" aria-label="Navegación de secciones">
        {items.map(it => (
          <a key={it.id} href={`#${it.id}`}
             className={`public-tab${currentId === it.id ? ' active' : ''}`}
             onClick={e => { e.preventDefault(); onNavigate(it.id); }}>
            {it.label}
          </a>
        ))}
      </nav>
      <div className="public-header-aux">
        <span className="sync-pulse" /> <span>{ES.publicProfileBadge}</span>
        <a href="/login.html" className="public-signin">{ES.signIn}</a>
      </div>
    </header>
  );
}
