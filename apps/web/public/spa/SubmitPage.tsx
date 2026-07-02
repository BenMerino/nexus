// Submit-DOI page (/submit). The body that lived in submit.html, ported to
// React Router. submit.html had no external entry module — just inline markup +
// an inline <script> IIFE. That script logic now lives in submit-page.js as a
// re-runnable mount() (legacy-mount.ts contract); this page drives it on every
// route entry and renders the exact .view markup.
//
// The markup is emitted as a raw-HTML block so the inline onclick="submit()"
// on the Check-DOI button keeps resolving to window.submit (set by mount()).
// No page-specific <style> travelled with submit.html — the .card / .tag / .view
// classes and the two inline style="" attributes are the shared design DNA.

import React from 'react';
import { useLegacyMounts } from './legacy-mount';

const BODY = `
  <header class="view-head">
    <div class="view-meta">
      <span class="tag mono">CROSSREF · OPENALEX · S2 · DATACITE</span>
    </div>
  </header>

  <div class="card">
    <label class="form-label">DOI</label>
    <div class="doi-input-row" style="display: flex; gap: 10px;">
      <input id="doi-input" class="doi-input" type="text" placeholder="e.g. 10.1038/nature12373" style="flex: 1;">
      <button class="primary-btn" onclick="submit()">Check DOI</button>
    </div>
  </div>

  <div id="status" class="mt-16"></div>
  <div id="results" class="mt-16"></div>
`;

export function SubmitPage() {
  useLegacyMounts([() => import('../submit-page.js')]);
  return <div className="view" dangerouslySetInnerHTML={{ __html: BODY }} />;
}
