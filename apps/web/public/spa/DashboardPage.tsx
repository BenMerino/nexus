// Dashboard page. The body that used to live in dashboard.html, ported
// to React Router. Renders the <div id="dashboard-root"> that
// dashboard-charts.tsx mounts into, plus the superadmin import button
// scaffolding (template + slot + the dashboard-import.js side-effect
// module).
//
// We don't refactor dashboard-charts / dashboard-import yet — they
// keep their existing "find element by id, mount on import" pattern.
// This is intentional: the migration target is "page lives at /dashboard
// instead of /dashboard.html"; the React-Router-native rewrite of those
// modules is a future, separate concern that doesn't need to happen now.

import React, { useEffect } from "react";

const importStyles = `
  .import-card {
    margin-top: 24px; padding: 20px 22px;
    background: var(--bg-card); border: 1px solid var(--border-soft); border-radius: var(--radius);
  }
  .import-card h3 { font-family: var(--mono); font-size: 10px; text-transform: uppercase; letter-spacing: 0.14em; color: var(--fg-dim); margin: 0 0 6px; font-weight: 500; }
  .import-card p { font-size: 13px; color: var(--fg-muted); margin: 0 0 12px; }
  .import-btn { background: var(--accent); color: #1a1612; border: 0; padding: 10px 18px; border-radius: 4px; font-weight: 500; cursor: pointer; font: inherit; }
  .import-btn:hover { filter: brightness(1.08); }
  .import-btn:disabled { opacity: 0.5; cursor: default; }
  .import-progress { margin-top: 10px; font-size: 12px; color: var(--fg-dim); font-family: var(--mono); }
  .progress-bar { height: 4px; background: var(--border-soft); border-radius: 2px; margin-top: 8px; overflow: hidden; }
  .progress-fill { height: 100%; background: var(--accent); border-radius: 2px; transition: width 0.3s; }
`;

export function DashboardPage() {
  useEffect(() => {
    // projects-gantt.css is imported by projects-gantt.tsx, so Vite bundles
    // it and injects the <link> at build time — no runtime injection needed.
    //
    // Side-effect imports: dashboard-charts mounts into #dashboard-root,
    // dashboard-import wires the superadmin import button. Both are
    // idempotent (dashboard-charts unmounts the prior root before
    // re-mounting; dashboard-import polls until #import-template exists).
    let cancelled = false;
    Promise.all([
      import("../dashboard-charts"),
      import("../dashboard-import.js" as string),
    ]).catch(() => { /* failures will surface in the UI */ });
    return () => { cancelled = true; void cancelled; };
  }, []);

  return (
    <>
      <style>{importStyles}</style>
      <div id="dashboard-root" />
      {/* Superadmin-only import card. dashboard-import.js toggles
          display:'' on #import-section after fetching /api/auth?action=me
          and confirming role==='superadmin'. The button's onclick is
          startImport(), set on window by dashboard-import.js. */}
      <div className="import-card" id="import-section" style={{ display: "none" }}>
        <h3>Bulk import · OpenAlex</h3>
        <p>Import all publications affiliated with your institution.</p>
        <button
          className="import-btn"
          id="import-btn"
          onClick={() => (window as unknown as { startImport?: () => void }).startImport?.()}
        >Import publications</button>
        <div className="import-progress" id="import-status" />
        <div className="progress-bar" id="progress-bar" style={{ display: "none" }}>
          <div className="progress-fill" id="progress-fill" />
        </div>
      </div>
    </>
  );
}
