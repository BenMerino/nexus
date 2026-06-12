import React, { useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { TenantPublicHeader } from './tenant-header';
import { ES } from './tenant-i18n';
import { tenantHref } from './tenant-data';
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

// Hero placeholder while the profile fetch is in flight — keeps the page from
// sitting blank on a cold load (no cached chrome on this route).
function ProfileSkeleton() {
  return (
    <section className="profile-hero profile-skel" aria-hidden="true">
      <div className="profile-head">
        <div className="profile-avatar skel-block" />
        <div className="profile-id">
          <div className="skel-line" style={{ width: 120 }} />
          <div className="skel-line" style={{ width: 320, height: 28, marginTop: 10 }} />
          <div className="skel-line" style={{ width: 220, marginTop: 12 }} />
        </div>
      </div>
    </section>
  );
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
          {/* Back link paints immediately from the slug; the tenant name fills
              in when the chrome fetch lands. */}
          {slug && (
            <a className="profile-back" href={tenantHref(slug)}>
              {chrome ? ES.profile.backTo(chrome.tenant.name) : ES.profile.back}
            </a>
          )}
          {profile && slug
            ? <AuthorProfile d={profile} slug={slug} />
            : <ProfileSkeleton />}
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
