import { useEffect, useState } from 'react';

export interface CurrentUser {
  user: string;
  tenant: string | null;
  logo: string | null;
  role: 'superadmin' | 'director' | 'secretary' | 'academic' | 'researcher' | string;
  tenantId: number;
  primaryColor: string | null;
  secondaryColor: string | null;
  profile: {
    name?: string;
    orcid?: string;
    position?: string;
    faculty?: string;
    affiliation?: string;
    ror?: string;
    titles?: string[];
  };
  hIndex: number | null;
  hIndexByType: Record<string, number> | null;
  userPapers: number | null;
  tenantPapers: number | null;
}

const CACHE_KEY = 'nexus.me';

export function useCurrentUser(): { me: CurrentUser | null; loading: boolean; error: string | null } {
  const [me, setMe] = useState<CurrentUser | null>(() => {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) as CurrentUser : null;
    } catch { return null; }
  });
  const [loading, setLoading] = useState(!me);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth?action=me')
      .then(r => r.status === 401 ? null : r.json())
      .then(d => {
        if (cancelled) return;
        if (!d) { window.location.href = '/login.html'; return; }
        setMe(d);
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(d)); } catch {}
        applyTheme(d);
      })
      .catch(e => !cancelled && setError(String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  return { me, loading, error };
}

function applyTheme(me: CurrentUser) {
  const body = document.body;
  if (me.primaryColor) body.style.setProperty('--primary', me.primaryColor);
  if (me.secondaryColor) body.style.setProperty('--secondary', me.secondaryColor);
}

const VIEW_AS_KEY = 'nexus.viewAs';

export function useViewAs(): [string | null, (role: string | null) => void] {
  const [viewAs, setViewAsState] = useState<string | null>(() => sessionStorage.getItem(VIEW_AS_KEY));
  const setViewAs = (role: string | null) => {
    if (role) sessionStorage.setItem(VIEW_AS_KEY, role);
    else sessionStorage.removeItem(VIEW_AS_KEY);
    setViewAsState(role);
    window.dispatchEvent(new CustomEvent('nexus:viewAsChange', { detail: role }));
  };
  useEffect(() => {
    const onChange = (e: Event) => setViewAsState((e as CustomEvent).detail ?? null);
    window.addEventListener('nexus:viewAsChange', onChange);
    return () => window.removeEventListener('nexus:viewAsChange', onChange);
  }, []);
  return [viewAs, setViewAs];
}

export function effectiveRole(me: CurrentUser | null, viewAs: string | null): string {
  if (me?.role === 'superadmin' && viewAs) return viewAs;
  return me?.role || 'public';
}
