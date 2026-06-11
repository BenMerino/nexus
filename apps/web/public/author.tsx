import React, { useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { TenantPublicHeader } from './tenant-header';
import { ES } from './tenant-i18n';
import { AuthorProfile, type AuthorProfileData } from './author-profile';

// /t/:slug/a/:orcid (Caddy rewrites to author.html); dev fallback via
// /author.html?slug=...&orcid=... (the Vite server has no path rewrite).
function readParams(): { slug: string | null; orcid: string | null } {
  const q = new URLSearchParams(window.location.search);
  const m = window.location.pathname.match(/^\/t\/([^/]+)\/a\/([^/?#]+)/);
  return {
    slug: q.get('slug') || (m ? m[1] : null),
    orcid: q.get('orcid') || (m ? decodeURIComponent(m[2]) : null),
  };
}

export function tenantHref(slug: string): string {
  return window.location.pathname.startsWith('/t/')
    ? `/t/${encodeURIComponent(slug)}`
    : `/tenant.html?slug=${encodeURIComponent(slug)}`;
}

interface Chrome {
  tenant: { id: number; name: string; slug: string | null; ror_id: string | null; logo_url: string | null; primary_color: string | null; secondary_color: string | null };
  stats: { yearRange?: { minYear: string | null; maxYear: string | null } };
}

function App() {
  const [{ slug, orcid }] = useState(readParams);
  const [chrome, setChrome] = useState<Chrome | null>(null);
  const [profile, setProfile] = useState<AuthorProfileData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Chrome (header branding) and the profile are independent reads — parallel.
  useEffect(() => {
    if (!slug || !orcid) { setError(ES.missingSlug); return; }
    const base = `/api/public/${encodeURIComponent(slug)}`;
    fetch(`${base}/stats?chrome=1`)
      .then(r => (r.ok ? (r.json() as Promise<Chrome>) : Promise.reject(new Error(ES.tenantNotFound))))
      .then(d => {
        setChrome(d);
        if (d.tenant.primary_color) document.body.style.setProperty('--primary', d.tenant.primary_color);
        if (d.tenant.secondary_color) document.body.style.setProperty('--secondary', d.tenant.secondary_color);
      })
      .catch(e => setError(e.message));
    fetch(`${base}/author/${encodeURIComponent(orcid)}`)
      .then(async r => {
        if (r.status === 404) throw new Error(ES.profile.notFound);
        const j = await r.json();
        if (!j.ok) throw new Error(j.error || `${ES.failedPrefix} (${r.status})`);
        setProfile(j.profile as AuthorProfileData);
      })
      .catch(e => setError(e.message));
  }, [slug, orcid]);

  useEffect(() => {
    if (profile && chrome) document.title = `${profile.name} — ${chrome.tenant.name}`;
  }, [profile, chrome]);

  if (error) {
    return <div className="public-app"><main className="public-main" style={{ color: 'var(--danger, #c00)' }}>{error}</main></div>;
  }
  return (
    <div className="public-app">
      {chrome && (
        <TenantPublicHeader tenant={chrome.tenant} items={[]} currentId="profile"
          onNavigate={() => {}} yearRange={chrome.stats.yearRange} />
      )}
      <main className="public-main">
        <div className="public-content">
          {slug && chrome && (
            <a className="profile-back" href={tenantHref(slug)}>
              {ES.profile.backTo(chrome.tenant.name)}
            </a>
          )}
          {profile && slug && <AuthorProfile d={profile} />}
        </div>
      </main>
    </div>
  );
}

let root: Root | null = null;
function mount() {
  const el = document.getElementById('author-root');
  if (!el) return;
  if (root) root.unmount();
  root = createRoot(el);
  root.render(<App />);
}
(window as any).__nexusMounts = (window as any).__nexusMounts || {};
(window as any).__nexusMounts[new URL(import.meta.url).pathname] = mount;
mount();
