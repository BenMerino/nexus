import React, { useEffect } from 'react';
import { Sidebar } from './shell-sidebar';
import { RoleSwitcher, TweaksPanel } from './shell-tweaks';
import { useCurrentUser } from './shell-helpers';

interface ShellProps {
  children: React.ReactNode;
  scroll?: boolean;
  currentPath?: string;
  tweaks?: boolean;
}

export function Shell({ children, scroll = false, currentPath, tweaks = false }: ShellProps) {
  const { me, loading } = useCurrentUser();
  const path = currentPath ?? window.location.pathname;

  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;
    if (!scroll) {
      body.classList.add('shell-fixed');
      html.classList.add('shell-fixed');
      return () => {
        body.classList.remove('shell-fixed');
        html.classList.remove('shell-fixed');
      };
    }
  }, [scroll]);

  if (loading && !me) {
    return (
      <div className="app">
        <aside className="sidebar" />
        <main className="main"><div className="view"><div className="eyebrow">Loading…</div></div></main>
      </div>
    );
  }

  return (
    <div className={`app ${scroll ? 'app-scroll' : ''}`}>
      <Sidebar
        me={me}
        currentPath={path}
        roleSwitcher={<RoleSwitcher me={me} />}
      />
      <main className="main">{children}</main>
      {tweaks && me?.role === 'superadmin' && <TweaksPanel open={true} onClose={() => { /* optional toggle */ }} />}
    </div>
  );
}

export { useCurrentUser } from './shell-helpers';
