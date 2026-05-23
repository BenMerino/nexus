// Entry point for the React Router SPA shell. Mounted by index.html into
// <div id="root"> as the single source of truth for routes that have been
// migrated off the legacy multi-HTML pattern.
//
// Coexistence: any route NOT registered here is still served by its own
// .html file in this directory (Caddy's try_files looks for a real file
// first, then falls back to /index.html). As pages migrate, each gets a
// <Route /> here and its .html file becomes a redirect; the catch-all
// fallback shrinks naturally toward zero.

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./spa/Layout";
import { AuthLayout } from "./spa/AuthLayout";
import { LoginPage } from "./spa/LoginPage";
import { DashboardPage } from "./spa/DashboardPage";
import { ThemeConfigPage } from "./spa/ThemeConfigPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes — no auth gate, no sidebar. */}
        <Route element={<Layout />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>
        {/* Authenticated routes — cookie gate + sidebar + theme tokens. */}
        <Route element={<AuthLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/theme" element={<ThemeConfigPage />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("spa-main: #root not found");
ReactDOM.createRoot(root).render(<App />);
