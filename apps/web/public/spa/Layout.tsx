// Shared frame for every React Router page. Today it's a thin pass-through
// since LoginPage is the only migrated route and renders its own chrome.
// As authenticated pages (dashboard, claustro, etc.) migrate, this is
// where the sidebar / topbar / auth gate move — replacing the per-page
// inline scripts and hand-placed <div id="sidebar-mount"> tags currently
// duplicated across .html files.

import React from "react";
import { Outlet } from "react-router-dom";

export function Layout() {
  return <Outlet />;
}
