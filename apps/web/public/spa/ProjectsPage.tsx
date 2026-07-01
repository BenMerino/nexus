// Projects page (/proyectos). The body that lived in proyectos.html, ported to
// React Router. proyectos.html had no external root module and no inline
// <style> — its markup was inline .claustro-view HTML driven by six ES-module
// IIFEs, and its page-specific CSS lived in the linked /claustro.css.
//
// The six IIFEs are now re-runnable mount()s (legacy-mount.ts contract): five
// register their window.claustro* globals; claustro-app is the orchestrator that
// wires the header buttons + fetches. useLegacyMounts drives all of them on
// every route entry, in an order that registers the globals before the
// orchestrator's init() reads them.
//
// The markup is emitted as a raw-HTML block so the ported project cards' inline
// onclick="claustroEdit(...)"/"claustroDelete(...)" keep resolving to the
// window.* globals set by claustro-app.js's mount(). claustro.css was a <link>
// in proyectos.html (absent under the SPA), so we import it here — the way
// LoginPage imports login.css — to carry the page-specific styles.

import React from 'react';
import { useLegacyMounts } from './legacy-mount';
import '../claustro.css';

const BODY = `
  <header class="view-head">
    <div>
      <h1 class="view-title">Projects</h1>
    </div>
    <div class="view-meta">
      <span class="tag mono" id="tag-count">0 PROJECTS</span>
      <span class="tag mono tag-muted" id="tag-amount">$0</span>
    </div>
  </header>

  <div id="proyectos-no-access" class="card" style="display:none;">
    <p>Only tenant administrative roles can manage projects.</p>
  </div>
  <div id="proyectos-area" style="display:none;">
    <div class="stat-row">
      <div class="stat">
        <div class="stat-label">Active projects</div>
        <div class="stat-value" id="stat-total-val">0</div>
        <div class="stat-sub">all faculties</div>
      </div>
      <div class="stat">
        <div class="stat-label">Total amount</div>
        <div class="stat-value" id="stat-amount-val" style="color: var(--accent);">$0</div>
        <div class="stat-sub">committed</div>
      </div>
      <div class="stat">
        <div class="stat-label">Competitive</div>
        <div class="stat-value" id="stat-conc-val">0</div>
        <div class="stat-sub" id="stat-conc-sub">of 0 projects</div>
      </div>
      <div class="stat">
        <div class="stat-label">External</div>
        <div class="stat-value" id="stat-ext-val">0</div>
        <div class="stat-sub">external funding</div>
      </div>
    </div>

    <div class="claustro-actions">
      <div class="filter-pills" id="filter-pills"></div>
      <button class="primary-btn" id="btn-toggle-form">+ New project</button>
    </div>

    <section class="card project-form" id="project-form-card" style="display:none;">
      <div class="eyebrow" id="proj-form-eyebrow">New project</div>
      <div id="project-form"></div>
      <div class="form-actions">
        <button class="secondary-btn" id="btn-cancel-project">Cancel</button>
        <button class="primary-btn" id="btn-save-project">Save</button>
      </div>
    </section>

    <section class="claustro-list">
      <div class="section-head">
        <div>
          <div class="eyebrow">Recorded projects</div>
          <h2 class="section-title" id="list-title">All projects</h2>
        </div>
        <span class="tag mono" id="list-count">0 results</span>
      </div>
      <div id="projects-list"></div>
    </section>
  </div>
`;

export function ProjectsPage() {
  // Order matters: the five registration modules run first so their window.*
  // globals exist before claustro-app's mount() init() reads them.
  useLegacyMounts([
    () => import('../claustro-funding.js'),
    () => import('../claustro-projects-ui.js'),
    () => import('../claustro-form-bind.js'),
    () => import('../claustro-form.js'),
    () => import('../claustro-render.js'),
    () => import('../claustro-app.js'),
  ]);
  return <div className="view claustro-view" dangerouslySetInnerHTML={{ __html: BODY }} />;
}
