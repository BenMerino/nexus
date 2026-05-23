import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Sidebar } from './shell-sidebar';
import { RoleSwitcher } from './shell-tweaks';
import { useCurrentUser } from './shell-helpers';
import { applyThemeMode, activeThemeMode } from './spa/theme-config';

function SidebarApp({ initialPath }: { initialPath: string }) {
  const { me } = useCurrentUser();
  const [currentPath, setCurrentPath] = useState(initialPath);
  useEffect(() => {
    const onNav = (e: Event) => {
      const d = (e as CustomEvent<{ path: string }>).detail;
      if (d?.path) setCurrentPath(d.path);
    };
    window.addEventListener('nexus:navigated', onNav);
    return () => window.removeEventListener('nexus:navigated', onNav);
  }, []);
  return <Sidebar me={me} currentPath={currentPath} roleSwitcher={<RoleSwitcher me={me} />} />;
}

function loadThemeTokens() {
  fetch('/api/theme-tokens').then(r => r.ok ? r.json() : null).then(tokens => {
    if (!tokens) return;
    const root = document.documentElement;
    for (const k in tokens) root.style.setProperty('--' + k, tokens[k]);
    applyThemeMode(activeThemeMode(), tokens);
    window.dispatchEvent(new CustomEvent('nexus:theme-tokens', { detail: tokens }));
  }).catch(() => {});
}

function mount() {
  loadThemeTokens();
  const el = document.getElementById('sidebar-mount') as (HTMLElement & { __mounted?: boolean }) | null;
  if (!el || el.__mounted) return;
  el.__mounted = true;
  const path = el.dataset.path || window.location.pathname;
  createRoot(el).render(<SidebarApp initialPath={path} />);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
else mount();
