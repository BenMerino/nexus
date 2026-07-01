// Settings page (/settings). The body that lived in settings.html, ported to
// React Router. This is an inline-html page: the legacy .js entry modules
// (settings-app / settings-indices) find their nodes by id and wire branding +
// indices, and inline onclick handlers (saveColors(), the #logo-preview upload
// trigger) call window functions those modules set. To keep those inline
// handlers working across true client-side nav, the exact .view markup is
// rendered via dangerouslySetInnerHTML and the modules' re-runnable mount()s
// are driven by the legacy-mount bridge on every React mount.
//
// color-extract.js is a pure helper (also used by admin.html) — not mounted
// here; only the two IIFE entries are. The page-specific <style>
// (branding-grid / logo-box / color-row / indices), which is not chrome (N9),
// travels with the page as it did in the old settings.html.

import React from 'react';
import { useLegacyMounts } from './legacy-mount';

const styles = `
  .branding-grid { display: grid; grid-template-columns: auto 1fr; gap: 24px; align-items: start; }
  .logo-box { width: 96px; height: 96px; border: 1px dashed var(--border); border-radius: var(--radius-card); display: flex; align-items: center; justify-content: center; overflow: hidden; cursor: pointer; background: var(--bg-inset); }
  .logo-box:hover { border-color: var(--accent); }
  .logo-box img { max-width: 96px; max-height: 96px; object-fit: contain; }
  .color-row { display: flex; align-items: center; gap: 10px; margin: 10px 0; }
  .color-row label { width: 140px; font-family: var(--font-mono); font-size: var(--text-micro); letter-spacing: var(--tracking-label); text-transform: uppercase; color: var(--fg-dim); }
  .color-row input[type="color"] { width: 40px; height: 32px; border: var(--border-w) solid var(--border); border-radius: var(--radius-control); cursor: pointer; padding: 0; background: transparent; }
  .color-row .hex { font-size: var(--text-micro); color: var(--fg-dim); font-family: var(--font-mono); }
  .indices-row { display: flex; gap: 14px; align-items: center; flex-wrap: wrap; }
  #idx-checks { display: flex; gap: 14px; flex-wrap: wrap; }
  #idx-checks label { display: inline-flex; gap: 6px; align-items: center; font-family: var(--font-mono); font-size: var(--text-label); }
`;

// Exact inner markup of the legacy <main>'s .view (ids + inline onclick
// preserved verbatim so the mounted modules and their window.* handlers wire up
// identically to settings.html).
const BODY = `
  <header class="view-head">
    <div>
      <h1 class="view-title">Settings</h1>
    </div>
  </header>

  <div class="card" id="branding-card" style="display:none;">
    <h3 id="branding-title" style="font-family: var(--font-display); font-weight: var(--weight-body); font-size: var(--text-h2); margin-bottom: 18px;">University branding</h3>
    <div class="branding-grid">
      <div>
        <div class="logo-box" id="logo-preview" onclick="document.getElementById('logo-input').click()" title="Click to upload logo">
          <span class="text-muted text-small">No logo</span>
        </div>
        <input type="file" id="logo-input" accept="image/*" style="display: none;">
        <div id="upload-status" class="text-small mt-8" style="width:96px;text-align:center;"></div>
      </div>
      <div>
        <div class="color-row">
          <label>Primary</label>
          <input type="color" id="primary-color" value="#e6a756">
          <span class="hex" id="primary-hex">#e6a756</span>
        </div>
        <div class="color-row">
          <label>Secondary</label>
          <input type="color" id="secondary-color" value="#6ba4d6">
          <span class="hex" id="secondary-hex">#6ba4d6</span>
        </div>
        <div id="color-suggestions" style="margin-top:12px;"></div>
        <button class="primary-btn" onclick="saveColors()" style="margin-top:12px;">Save colors</button>
        <span id="color-status" class="text-small" style="margin-left:10px;"></span>
      </div>
    </div>
  </div>

  <div class="card" id="indices-card" style="display:none; margin-top:18px;">
    <h3 style="font-family: var(--font-display); font-weight: var(--weight-body); font-size: var(--text-h2); margin-bottom: 6px;">Accepted indices (faculty)</h3>
    <div class="text-small text-muted" style="margin-bottom:16px;">Define which citation indices count as a qualified publication when evaluating the academic faculty.</div>
    <div class="indices-row">
      <div id="idx-checks"></div>
      <button class="primary-btn" id="idx-save">Save</button>
      <span id="idx-status" class="text-small"></span>
    </div>
  </div>
`;

export function SettingsPage() {
  useLegacyMounts([
    () => import('../settings-app.js' as string),
    () => import('../settings-indices.js' as string),
  ]);
  return (
    <>
      <style>{styles}</style>
      <div className="view" dangerouslySetInnerHTML={{ __html: BODY }} />
    </>
  );
}
