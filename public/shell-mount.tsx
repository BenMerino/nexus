import React from 'react';
import { createRoot } from 'react-dom/client';
import { Sidebar } from './shell-sidebar';
import { RoleSwitcher } from './shell-tweaks';
import { useCurrentUser } from './shell-helpers';

function SidebarApp({ currentPath }: { currentPath: string }) {
  const { me } = useCurrentUser();
  return <Sidebar me={me} currentPath={currentPath} roleSwitcher={<RoleSwitcher me={me} />} />;
}

function mount() {
  const el = document.getElementById('sidebar-mount');
  if (!el) return;
  const path = el.dataset.path || window.location.pathname;
  createRoot(el).render(<SidebarApp currentPath={path} />);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
}
