import React from 'react';

interface Tenant {
  id: number;
  name: string;
  slug: string | null;
  ror_id: string | null;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
}

export function TenantHeader({ tenant, yearRange }: {
  tenant: Tenant;
  yearRange: { minYear: string | null; maxYear: string | null };
}) {
  return (
    <div className="tenant-header">
      {tenant.logo_url ? <img src={tenant.logo_url} alt={tenant.name} /> : null}
      <div>
        <div className="title">{tenant.name}</div>
        {yearRange.minYear && yearRange.maxYear ? (
          <div style={{ fontSize: 12, opacity: 0.85 }}>
            Publications {yearRange.minYear}–{yearRange.maxYear}
          </div>
        ) : null}
      </div>
      {tenant.ror_id ? (
        <a
          className="ror"
          href={tenant.ror_id.startsWith('http') ? tenant.ror_id : `https://ror.org/${tenant.ror_id}`}
          target="_blank"
          rel="noopener noreferrer"
        >ROR ↗</a>
      ) : null}
      <div className="spacer" />
      <a href="/login.html">Sign in</a>
    </div>
  );
}
