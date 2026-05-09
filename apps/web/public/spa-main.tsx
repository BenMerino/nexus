// Entry point for the React Router SPA shell. Mounted by index.html into
// <div id="root"> as the single source of truth for routes that have been
// migrated off the legacy multi-HTML pattern.
//
// Coexistence: any route NOT registered here is still served by its own
// .html file in this directory (Caddy's try_files looks for a real file
// first, then falls back to /index.html). As pages migrate one at a time,
// each gets a <Route /> here and its .html file is deleted; the catch-all
// fallback shrinks naturally toward zero.

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./spa/Layout";
import { LoginPage } from "./spa/LoginPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("spa-main: #root not found");
ReactDOM.createRoot(root).render(<App />);
