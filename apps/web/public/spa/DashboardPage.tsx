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
import { Button } from "../../ui/composed/Button";

/* Page-specific bits only, all token-driven (no opaque bg, no raw px, no hex).
   The import card uses the `.card` class for glass; the button is the composed
   Button (primary → sky-driven gradient, owns its own fg) — not hand-rolled. */
const importStyles = `
  .import-card { margin-top: var(--space-6); }  /* surface + padding from .card */
  .import-card h3 { font-family: var(--font-mono); font-size: var(--text-micro); text-transform: uppercase; letter-spacing: var(--tracking-label); color: var(--fg-dim); margin: 0 0 var(--space-2); font-weight: var(--weight-label); }
  .import-card p { font-size: var(--text-detail); color: var(--fg-muted); margin: 0 0 var(--space-3); }
  .import-progress { margin-top: var(--space-3); font-size: var(--text-label); color: var(--fg-dim); font-family: var(--font-mono); }
  .progress-bar { height: 4px; background: var(--bg-inset); border-radius: var(--radius-xs); margin-top: var(--space-2); overflow: hidden; }
  .progress-fill { height: 100%; background: var(--accent); border-radius: var(--radius-xs); transition: width 0.3s; }
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
      <div className="card import-card" id="import-section" style={{ display: "none" }}>
        <h3>Bulk import · OpenAlex</h3>
        <p>Import all publications affiliated with your institution.</p>
        <Button
          variant="primary"
          id="import-btn"
          onClick={() => (window as unknown as { startImport?: () => void }).startImport?.()}
        >Import publications</Button>
        <div className="import-progress" id="import-status" />
        <div className="progress-bar" id="progress-bar" style={{ display: "none" }}>
          <div className="progress-fill" id="progress-fill" />
        </div>
      </div>
    </>
  );
}
