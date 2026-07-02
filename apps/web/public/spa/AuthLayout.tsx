// Layout for every authenticated route — the ONE app shell, now fully inside
// the React Router tree (no more #sidebar-mount side-effect mount, no
// spa-router.js). Renders the floating-glass sidebar (product brand + nav) and
// the breadcrumb header (tenant identity) around the routed page, so sidebar
// nav is true client-side navigation via React Router <Link>.
//
//  - Cookie auth gate (redirect to /login if no nexus_logged_in cookie)
//  - Theme tokens loaded + cached (load-theme-tokens.ts)
//  - body.shell-fixed while mounted (the fixed-shell no-scroll layout)
//  - .app-headered flips .app into the fixed-chrome layout (app-chrome.css)

import React, { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Sidebar } from "../shell-sidebar";
import { RoleSwitcher } from "../shell-tweaks";
import { TenantPublicHeader } from "../tenant-header";
import { useCurrentUser } from "../shell-helpers";
import { userCrumbs } from "./auth-crumbs";
import { loadThemeTokens } from "./load-theme-tokens";

export function AuthLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { me } = useCurrentUser();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    if (!document.cookie.includes("nexus_logged_in=1")) {
      navigate("/login", { replace: true });
      return;
    }
    setAuthChecked(true);
  }, [navigate]);

  // Theme tokens once, on first authenticated render (idempotent fetch).
  useEffect(() => { if (authChecked) loadThemeTokens(); }, [authChecked]);

  // The fixed shell locks the body to 100vh no-scroll; the inner .main is the
  // only scroller. Login (no AuthLayout) must NOT have it, so scope it to mount.
  useEffect(() => {
    document.body.classList.add("shell-fixed");
    return () => document.body.classList.remove("shell-fixed");
  }, []);

  if (!authChecked) return null;

  // Graph explorer wants an edge-to-edge canvas (was <main class="main-fullbleed">).
  const fullbleed = location.pathname === "/overview";

  return (
    <div className="app app-headered">
      {me && (
        <TenantPublicHeader
          tenant={{ name: me.tenant || "Pliny", ror_id: me.profile?.ror ?? null, logo_url: null }}
          items={[]} currentId="" onNavigate={() => {}} signedIn
          crumbs={userCrumbs(me)}
        />
      )}
      <Sidebar me={me} currentPath={location.pathname} roleSwitcher={<RoleSwitcher me={me} />} />
      <main className={`main${fullbleed ? " main-fullbleed" : ""}`}>
        <Outlet />
      </main>
    </div>
  );
}
