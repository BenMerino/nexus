import React, { useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { PublicShell } from './public-shell';
import { ES } from './tenant-i18n';
import { tenantHref } from './tenant-data';
import { AuthorProfile, type AuthorProfileData } from './author-profile';
import type { PublicView } from './use-public-route';

// The author profile is not itself an entity view, so nav links must LEAVE this
// page for the tenant page's entity views. Prod deep-links are /t/:slug/<entity>
// (Caddy rewrite); the Vite dev server has no rewrite, so fall back to
// tenant.html?slug=…&view=<entity> (read by tenant.tsx's usePublicRoute).
function entityHref(slug: string, view: PublicView): string {
  const base = tenantHref(slug); // /t/:slug OR /tenant.html?slug=…
  if (view === 'overview') return base;
  return base.includes('?') ? `${base}&view=${view}` : `${base}/${view}`;
}

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
  if (!slug) return null; // readParams already set the missing-slug error above.

  // The profile is not an entity view, so all chrome nav is FULL-NAV back to the
  // tenant page: sidebar → that entity view, a unit hit → the tenant faculty view
  // scoped to the unit. The shell builds the header/sidebar/search identically to
  // the tenant page — this page only declares where those links go.
  return (
    <PublicShell
      tenant={chrome?.tenant ?? null}
      slug={slug}
      view={'' as PublicView}
      hrefFor={v => entityHref(slug, v)}
      navigate={v => { window.location.href = entityHref(slug, v); }}
      onSelectUnit={u => { window.location.href = tenantHref(slug, u.unitKey); }}
      yearRange={chrome?.stats.yearRange}
    >
      {/* Back link paints immediately from the slug; the tenant name fills in
          when the chrome fetch lands. */}
      <a className="profile-back" href={tenantHref(slug)}>
        {chrome ? ES.profile.backTo(chrome.tenant.name) : ES.profile.back}
      </a>
      {profile
        ? <AuthorProfile d={profile} slug={slug} />
        : <AuthorProfile.Skeleton />}
    </PublicShell>
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
