// Entry point for the React Router SPA shell. Mounted by index.html into
// <div id="root">. Every authenticated app page is a route here under the one
// AuthLayout shell (sidebar + header + auth gate + theme). The former legacy
// multi-HTML pages now leave behind only a redirect stub (<name>.html →
// /name); Caddy's try_files (prod) and the vite spaRouteFallback (dev) resolve
// extensionless routes to this SPA. The public tenant/author pages stay their
// own HTML entries (their own shell, PublicShell) — not part of this router.

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./spa/Layout";
import { AuthLayout } from "./spa/AuthLayout";
import { LoginPage } from "./spa/LoginPage";
import { DashboardPage } from "./spa/DashboardPage";
import { ThemeConfigPage } from "./spa/ThemeConfigPage";
import { FacultiesPage } from "./spa/FacultiesPage";
import { AcademicsPage } from "./spa/AcademicsPage";
import { PapersPage } from "./spa/PapersPage";
import { JournalsPage } from "./spa/JournalsPage";
import { GraphExplorerPage } from "./spa/GraphExplorerPage";
import { ProjectsPage } from "./spa/ProjectsPage";
import { SubmitPage } from "./spa/SubmitPage";
import { RosterPage } from "./spa/RosterPage";
import { SettingsPage } from "./spa/SettingsPage";
import { AdminPage } from "./spa/AdminPage";
import { AuthorImportPage } from "./spa/AuthorImportPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes — no auth gate, no sidebar. */}
        <Route element={<Layout />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>
        {/* Authenticated routes — cookie gate + sidebar + header + theme. */}
        <Route element={<AuthLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/faculties" element={<FacultiesPage />} />
          <Route path="/academics" element={<AcademicsPage />} />
          <Route path="/papers" element={<PapersPage />} />
          <Route path="/journals" element={<JournalsPage />} />
          <Route path="/overview" element={<GraphExplorerPage />} />
          <Route path="/proyectos" element={<ProjectsPage />} />
          <Route path="/submit" element={<SubmitPage />} />
          <Route path="/roster" element={<RosterPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/author-import" element={<AuthorImportPage />} />
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
