// Layout for authenticated routes. Replaces the boilerplate that was
// duplicated across every legacy .html page:
//   - Cookie auth gate (redirect to /login if no nexus_logged_in cookie)
//   - Sidebar mount via the existing shell-mount system
//   - Theme tokens loaded from /api/theme-tokens and injected as CSS vars
//
// Implementation note: we delegate the sidebar to the existing
// shell-mount.tsx by rendering a <div id="sidebar-mount"> and importing
// the side-effect module. This avoids forking the sidebar logic during
// the migration; once every page is on React Router, shell-mount.tsx
// can be refactored into a proper React component and dropped here
// directly.

import React, { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

export function AuthLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    if (!document.cookie.includes("nexus_logged_in=1")) {
      navigate("/login", { replace: true });
      return;
    }
    setAuthChecked(true);
  }, [navigate]);

  // Mount the sidebar + theme tokens once on first authenticated render.
  // shell-mount.tsx finds <div id="sidebar-mount"> by id and is idempotent
  // (guards via el.__mounted), so re-running is safe.
  useEffect(() => {
    if (!authChecked) return;
    import("../shell-mount").catch(() => {});
  }, [authChecked]);

  if (!authChecked) return null;

  return (
    <div className="app app-scroll">
      <div id="sidebar-mount" data-path={location.pathname} />
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
