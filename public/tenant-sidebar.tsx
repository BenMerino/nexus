import React from 'react';

interface TenantLike {
  name: string;
  slug: string | null;
  ror_id: string | null;
  logo_url: string | null;
}

export interface PublicNavItem { id: string; label: string }

const ROR_HOST = 'https://ror.org/';

function rorHref(raw: string): string {
  return raw.startsWith('http') ? raw : `${ROR_HOST}${raw}`;
}

function rorId(raw: string): string {
  const m = raw.match(/([^/]+)$/);
  return m ? m[1] : raw;
}

export function TenantPublicSidebar({
  tenant, items, currentId, onNavigate, yearRange,
}: {
  tenant: TenantLike;
  items: PublicNavItem[];
  currentId: string;
  onNavigate: (id: string) => void;
  yearRange: { minYear: string | null; maxYear: string | null };
}) {
  return (
    <aside className="sidebar">
      <div className="tenant-chip">
        <div className="tenant-brand">
          <div className="tenant-mark">
            {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : null}
          </div>
          <div className="brand-text">
            <div className="brand-name">Nexus</div>
            <div className="brand-tenant">{tenant.name} · Research</div>
          </div>
        </div>
        {tenant.ror_id ? (
          <div className="tenant-chip-meta">
            <a href={rorHref(tenant.ror_id)} target="_blank" rel="noopener noreferrer"
               style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.08em', color: 'var(--fg-dim)' }}>
              ROR {rorId(tenant.ror_id)}
            </a>
          </div>
        ) : null}
        {yearRange.minYear && yearRange.maxYear ? (
          <div style={{ marginTop: 6, fontSize: 11, color: 'var(--fg-muted)', fontFamily: 'var(--mono)' }}>
            {yearRange.minYear}–{yearRange.maxYear}
          </div>
        ) : null}
      </div>

      <nav className="nav-list">
        <div className="nav-section-label">Sections</div>
        {items.map(it => (
          <a
            key={it.id}
            href={`#${it.id}`}
            className={`nav-item ${currentId === it.id ? 'active' : ''}`}
            onClick={e => { e.preventDefault(); onNavigate(it.id); }}
          >
            {it.label}
          </a>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div><span className="sync-pulse" />Public profile</div>
        <div className="sidebar-user-row">
          <span>Public</span>
          <a href="/login.html">sign in</a>
        </div>
      </div>
    </aside>
  );
}
